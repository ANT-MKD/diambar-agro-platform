import type { LiveTrackingSnapshot } from "./types";

const STORAGE_KEY = "diambar-live-tracking";
const CHANNEL = "diambar-tracking-update";

type TrackingMap = Record<string, LiveTrackingSnapshot>;

function readAll(): TrackingMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TrackingMap;
  } catch {
    /* ignore */
  }
  return {};
}

function writeAll(map: TrackingMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { map } }));
}

export function getLiveTracking(trackingId: string): LiveTrackingSnapshot | null {
  return readAll()[trackingId] ?? null;
}

export function setLiveTracking(snapshot: LiveTrackingSnapshot): void {
  const map = readAll();
  map[snapshot.trackingId] = snapshot;
  writeAll(map);
}

export function removeLiveTracking(trackingId: string): void {
  const map = readAll();
  delete map[trackingId];
  writeAll(map);
}

export function subscribeLiveTracking(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const onCustom = () => listener();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANNEL, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANNEL, onCustom);
  };
}
