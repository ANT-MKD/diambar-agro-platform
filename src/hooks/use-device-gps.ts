import { useEffect, useState, useSyncExternalStore } from "react";
import { refreshMarket } from "@/data/market-remote";
import { startGpsSessionFn } from "@/lib/market/functions";
import {
  isNativeApp,
  startDeviceGps,
  type GpsSession,
  type GpsStatus,
} from "@/lib/tracking/device-gps";

const OFF: GpsStatus = {
  state: "off",
  native: false,
  lastSentAt: null,
  accuracyM: null,
  sendFailing: false,
};
/** Le serveur a arrêté le suivi : nouvelle vérification 2 min plus tard. */
const SERVER_STOP_RECHECK_MS = 2 * 60_000;

// État partagé : le suivi tourne dans la mise en page du livreur, les écrans
// (fiche de course) affichent son état.
let shared: GpsStatus = OFF;
const listeners = new Set<() => void>();
function publish(s: GpsStatus) {
  shared = s;
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** État du GPS du téléphone, tel que l'envoie l'espace livreur. */
export function useGpsStatus(): GpsStatus {
  return useSyncExternalStore(
    subscribe,
    () => shared,
    () => OFF,
  );
}

async function getSession(): Promise<GpsSession> {
  const res = await startGpsSessionFn();
  if (!res.ok) throw new Error(res.message);
  return { token: res.token, expiresAt: res.expiresAt };
}

/**
 * Envoie la position du téléphone tant que `enabled` (course démarrée).
 * `retry` relance après un refus d'autorisation.
 */
export function useDeviceGps(enabled: boolean): GpsStatus & { retry: () => void } {
  const [status, setStatus] = useState<GpsStatus>(OFF);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => publish(status), [status]);
  useEffect(() => () => publish(OFF), []);

  useEffect(() => {
    if (!enabled) {
      setStatus({ ...OFF, native: isNativeApp() });
      return;
    }
    let recheck: number | undefined;
    const stop = startDeviceGps({
      getSession,
      onStatus: setStatus,
      onServerStop: () => {
        setStatus({ ...OFF, native: isNativeApp() });
        void refreshMarket();
        recheck = window.setTimeout(() => setAttempt((n) => n + 1), SERVER_STOP_RECHECK_MS);
      },
    });
    return () => {
      stop();
      window.clearTimeout(recheck);
    };
  }, [enabled, attempt]);

  return { ...status, retry: () => setAttempt((n) => n + 1) };
}
