import { getSessionSecret } from "./session.server";

/**
 * Jeton signé (HMAC-SHA256) et sans état côté serveur : contrairement à un
 * stockage en mémoire, il survit à un redémarrage du process et reste valide
 * même réparti sur plusieurs instances (Cloudflare Workers) — il n'y a rien
 * à retenir côté serveur, tout est dans le jeton lui-même et sa signature.
 */

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSignedToken<T extends object>(
  payload: T,
  ttlMs: number,
): Promise<string> {
  const body = base64url(
    new TextEncoder().encode(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })),
  );
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64url(new Uint8Array(sig))}`;
}

export async function verifySignedToken<T extends object>(
  token: string,
): Promise<(T & { exp: number }) | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sig) as BufferSource,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as T & {
      exp: number;
    };
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
