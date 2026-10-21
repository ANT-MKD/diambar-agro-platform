import type {
  BackgroundGeolocationPlugin,
  Location,
} from "@capacitor-community/background-geolocation";
import { haversineKm } from "./geo-math";

// GPS du téléphone du livreur, envoyé au serveur (/api/driver-position).
// - Application Android : suivi en arrière-plan (notification permanente),
//   même quand le livreur suit Waze ou Google Maps ou que l'écran est éteint.
//   Les envois partent du natif : ceux de la page sont ralentis en arrière-plan.
// - Navigateur : seulement tant que la page est ouverte à l'écran.

export type GpsState =
  /** Pas de suivi (aucune course démarrée). */
  | "off"
  /** En attente de la première position. */
  | "starting"
  | "active"
  /** Autorisation refusée ou localisation du téléphone désactivée. */
  | "denied"
  /** Ce navigateur ne donne pas la position. */
  | "unsupported";

export type GpsStatus = {
  state: GpsState;
  /** Application Android (suivi en arrière-plan possible). */
  native: boolean;
  lastSentAt: number | null;
  accuracyM: number | null;
  /** Le dernier envoi a échoué (réseau) : la position repartira dès que possible. */
  sendFailing: boolean;
};

export type GpsFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speedKmh: number | null;
  /** Heure de la mesure (ms). */
  at: number;
};

export type GpsSession = { token: string; expiresAt: string };

/** Envoi au plus toutes les 10 s, et seulement après 40 m parcourus… */
const MIN_INTERVAL_MS = 10_000;
const MIN_MOVE_M = 40;
/** … sauf une fois par minute, même à l'arrêt (la position reste « fraîche »). */
const HEARTBEAT_MS = 60_000;
/** Une mesure plus ancienne n'est plus renvoyée comme position actuelle. */
const HEARTBEAT_MAX_FIX_AGE_MS = 10 * 60_000;
/** Après un échec d'envoi (réseau), nouvel essai au plus tôt 15 s plus tard. */
const RETRY_MS = 15_000;
/** Le jeton est renouvelé avant son expiration. */
const TOKEN_MARGIN_MS = 10 * 60_000;

export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Faut-il envoyer cette mesure, vu le dernier envoi ? */
export function shouldSend(
  prev: { fix: GpsFix; sentAt: number } | null,
  fix: GpsFix,
  now: number,
): boolean {
  if (!prev) return true;
  const elapsed = now - prev.sentAt;
  if (elapsed >= HEARTBEAT_MS) return true;
  if (elapsed < MIN_INTERVAL_MS) return false;
  return haversineKm(prev.fix, fix) * 1000 >= MIN_MOVE_M;
}

const finiteOrNull = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function fixFromNative(loc: Location): GpsFix {
  const speed = finiteOrNull(loc.speed);
  return {
    lat: loc.latitude,
    lng: loc.longitude,
    accuracy: finiteOrNull(loc.accuracy),
    heading: finiteOrNull(loc.bearing),
    speedKmh: speed != null ? speed * 3.6 : null,
    at: finiteOrNull(loc.time) ?? Date.now(),
  };
}

export function fixFromBrowser(pos: GeolocationPosition): GpsFix {
  const c = pos.coords;
  const speed = finiteOrNull(c.speed);
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: finiteOrNull(c.accuracy),
    heading: finiteOrNull(c.heading),
    speedKmh: speed != null ? speed * 3.6 : null,
    at: pos.timestamp || Date.now(),
  };
}

type Post = (
  url: string,
  token: string,
  body: string,
) => Promise<{ status: number; data: unknown }>;

const browserPost: Post = async (url, token, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body,
    keepalive: true,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

let nativePlugin: BackgroundGeolocationPlugin | null = null;

async function loadNative() {
  const { registerPlugin, CapacitorHttp } = await import("@capacitor/core");
  nativePlugin ??= registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  const post: Post = async (url, token, body) => {
    const res = await CapacitorHttp.post({
      url,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      data: JSON.parse(body),
    });
    const data = typeof res.data === "string" ? safeJson(res.data) : res.data;
    return { status: res.status, data };
  };
  return { plugin: nativePlugin, post };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Ouvre les réglages de l'application (autorisation de localisation refusée). */
export async function openGpsSettings(): Promise<void> {
  if (!isNativeApp()) return;
  const { plugin } = await loadNative();
  await plugin.openSettings();
}

/**
 * Démarre le suivi. Renvoie la fonction d'arrêt.
 * `onServerStop` : le serveur ne veut plus de positions (plus de course
 * démarrée) ; le suivi s'arrête de lui-même.
 */
export function startDeviceGps(opts: {
  getSession: () => Promise<GpsSession>;
  onStatus: (s: GpsStatus) => void;
  onServerStop?: () => void;
  endpoint?: string;
}): () => void {
  const native = isNativeApp();
  const endpoint = opts.endpoint ?? `${globalThis.location?.origin ?? ""}/api/driver-position`;
  let stopped = false;
  let session: GpsSession | null = null;
  let last: { fix: GpsFix; sentAt: number } | null = null;
  let latest: GpsFix | null = null;
  let sending = false;
  let failedAt = 0;
  let queued: GpsFix | null = null;
  let post: Post = browserPost;
  let cleanup: (() => void) | null = null;
  let status: GpsStatus = {
    state: "starting",
    native,
    lastSentAt: null,
    accuracyM: null,
    sendFailing: false,
  };
  const emit = (patch: Partial<GpsStatus>) => {
    status = { ...status, ...patch };
    if (!stopped) opts.onStatus(status);
  };
  emit({});

  const token = async (renew: boolean) => {
    const expiresAt = session ? Date.parse(session.expiresAt) : 0;
    if (renew || !session || expiresAt - Date.now() < TOKEN_MARGIN_MS) {
      session = await opts.getSession();
    }
    return session.token;
  };

  const sendNow = async (fix: GpsFix) => {
    const body = JSON.stringify({
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speedKmh: fix.speedKmh,
      at: fix.at,
    });
    let res = await post(endpoint, await token(false), body);
    if (res.status === 401) res = await post(endpoint, await token(true), body);
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
    last = { fix, sentAt: Date.now() };
    emit({ state: "active", lastSentAt: last.sentAt, sendFailing: false });
    const tracking = (res.data as { tracking?: unknown } | null)?.tracking;
    if (tracking === false) {
      stop();
      opts.onServerStop?.();
    }
  };

  const send = async (fix: GpsFix) => {
    if (sending) {
      queued = fix;
      return;
    }
    sending = true;
    try {
      await sendNow(fix);
      failedAt = 0;
    } catch {
      // Réseau coupé : nouvel essai 15 s plus tard, avec la mesure la plus récente.
      failedAt = Date.now();
      emit({ sendFailing: true });
    } finally {
      sending = false;
    }
    if (queued && !stopped) {
      const next = queued;
      queued = null;
      void send(next);
    }
  };

  const onFix = (fix: GpsFix) => {
    if (stopped) return;
    latest = fix;
    emit({ state: "active", accuracyM: fix.accuracy });
    const now = Date.now();
    if (failedAt && now - failedAt < RETRY_MS) return;
    if (failedAt || shouldSend(last, fix, now)) void send(fix);
  };

  // À l'arrêt, le navigateur ne redonne pas de position : la dernière est
  // renvoyée une fois par minute pour rester visible sur les cartes.
  const heartbeat = setInterval(() => {
    if (stopped || !latest || sending) return;
    const now = Date.now();
    if (now - latest.at > HEARTBEAT_MAX_FIX_AGE_MS) return;
    if (failedAt ? now - failedAt < RETRY_MS : last && now - last.sentAt < HEARTBEAT_MS) return;
    void send({ ...latest, at: now });
  }, 15_000);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(heartbeat);
    cleanup?.();
    cleanup = null;
  };

  if (native) {
    void (async () => {
      try {
        const { plugin, post: nativePost } = await loadNative();
        post = nativePost;
        if (stopped) return;
        const id = await plugin.addWatcher(
          {
            backgroundTitle: "Diambar Agro · course en cours",
            backgroundMessage: "Votre position est transmise pour le suivi de la livraison.",
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (loc, err) => {
            if (err) {
              if (err.code === "NOT_AUTHORIZED") emit({ state: "denied" });
              return;
            }
            if (loc) onFix(fixFromNative(loc));
          },
        );
        if (stopped) void plugin.removeWatcher({ id });
        else cleanup = () => void plugin.removeWatcher({ id }).catch(() => undefined);
      } catch {
        emit({ state: "denied" });
      }
    })();
  } else if (typeof navigator !== "undefined" && navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (pos) => onFix(fixFromBrowser(pos)),
      (err) => {
        // 1 = refusé ; 2 et 3 (pas de signal, délai) : le suivi continue.
        if (err.code === err.PERMISSION_DENIED) emit({ state: "denied" });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 60_000 },
    );
    cleanup = () => navigator.geolocation.clearWatch(id);
  } else {
    emit({ state: "unsupported" });
  }

  return stop;
}
