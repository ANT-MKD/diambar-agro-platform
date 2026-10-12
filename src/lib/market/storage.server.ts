// Fichiers (photos de produits, preuves de livraison) dans Supabase Storage,
// par son API HTTP : fonctionne sur Node comme sur Cloudflare Workers.
//
// Réglages (secrets du déploiement, jamais dans le code) :
// - SUPABASE_URL : adresse du projet (https://<projet>.supabase.co) ;
// - SUPABASE_SECRET_KEY : clé secrète du projet (Settings → API Keys), qui
//   ne quitte jamais le serveur.
//
// Deux espaces :
// - « produits » : public, les photos du catalogue s'affichent par leur lien ;
// - « preuves » : privé, chaque photo n'est montrée qu'au moyen d'un lien
//   signé valable quelques minutes, à une personne autorisée.

export const BUCKETS = { public: "produits", private: "preuves" } as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

const TIMEOUT_MS = 15_000;
const SIGNED_URL_SECONDS = 15 * 60;

function base(): string | null {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  return url ? `${url}/storage/v1` : null;
}

function key(): string | null {
  return process.env.SUPABASE_SECRET_KEY?.trim() || null;
}

export function storageConfigured(): boolean {
  return !!base() && !!key();
}

function headers(extra: Record<string, string> = {}) {
  const k = key()!;
  return { Authorization: `Bearer ${k}`, apikey: k, ...extra };
}

/** Chemin complet enregistré dans la table files : « bucket/chemin ». */
export function storageKey(bucket: Bucket, path: string) {
  return `${bucket}/${path}`;
}

function split(storageKeyValue: string): { bucket: string; path: string } {
  const i = storageKeyValue.indexOf("/");
  return { bucket: storageKeyValue.slice(0, i), path: storageKeyValue.slice(i + 1) };
}

/** Fichier non conservé (mode démo sans stockage configuré). */
export const NOT_STORED_PREFIX = "non-conserve/";

export function isStored(storageKeyValue: string) {
  return !storageKeyValue.startsWith(NOT_STORED_PREFIX);
}

/** Lien direct d'un fichier de l'espace public. */
export function publicUrl(storageKeyValue: string): string | null {
  const b = base();
  if (!b || !isStored(storageKeyValue)) return null;
  const { bucket, path } = split(storageKeyValue);
  if (bucket !== BUCKETS.public) return null;
  return `${b}/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadObject(
  bucket: Bucket,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const b = base();
  if (!b || !key()) return { ok: false, error: "stockage non configuré" };
  try {
    const res = await call(`${b}/object/${bucket}/${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": contentType, "x-upsert": "false" }),
      body: new Blob([bytes as BlobPart], { type: contentType }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      const error = `Storage ${res.status}${body?.message ? ` : ${body.message}` : ""}`;
      console.error(`[fichiers] échec d'envoi : ${error}`);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "erreur réseau";
    console.error(`[fichiers] échec d'envoi : ${error}`);
    return { ok: false, error };
  }
}

/** Lien temporaire vers un fichier privé (null si indisponible). */
export async function signedUrl(storageKeyValue: string): Promise<string | null> {
  const b = base();
  if (!b || !key() || !isStored(storageKeyValue)) return null;
  const { bucket, path } = split(storageKeyValue);
  try {
    const res = await call(`${b}/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { signedURL?: string; signedUrl?: string };
    const rel = body.signedURL ?? body.signedUrl;
    if (!rel) return null;
    return rel.startsWith("http") ? rel : `${b}${rel.startsWith("/") ? "" : "/"}${rel}`;
  } catch {
    return null;
  }
}

export async function removeObjects(storageKeys: string[]): Promise<void> {
  const b = base();
  if (!b || !key()) return;
  const byBucket = new Map<string, string[]>();
  for (const k of storageKeys.filter(isStored)) {
    const { bucket, path } = split(k);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, prefixes] of byBucket) {
    await call(`${b}/object/${bucket}`, {
      method: "DELETE",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes }),
    }).catch(() => undefined);
  }
}

// --- Images envoyées par le navigateur ----------------------------------------

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Décode une image « data:image/…;base64,… » envoyée par le navigateur. */
export function decodeImage(
  dataUrl: string,
): { ok: true; bytes: Uint8Array; mime: string; ext: string } | { ok: false; message: string } {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m)
    return { ok: false, message: "Image illisible : choisissez une photo JPEG, PNG ou WebP." };
  const ext = IMAGE_TYPES[m[1]];
  if (!ext) return { ok: false, message: "Format non accepté : JPEG, PNG ou WebP." };
  const binary = atob(m[2]);
  if (binary.length > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Photo trop lourde (2 Mo maximum)." };
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (!looksLikeImage(bytes, m[1])) {
    return { ok: false, message: "Ce fichier n'est pas une image valide." };
  }
  return { ok: true, bytes, mime: m[1], ext };
}

/** Vérifie la signature du fichier, pas seulement le type annoncé. */
function looksLikeImage(b: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === "image/webp") {
    return (
      String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" &&
      String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP"
    );
  }
  return false;
}
