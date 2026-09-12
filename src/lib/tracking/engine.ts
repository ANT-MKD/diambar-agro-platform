import { fetchDrivingRoute } from "./osrm";
import { getLiveTracking, removeLiveTracking, setLiveTracking } from "./store";
import { bearingDeg, etaMinutesFromRoute, pointAlongRoute } from "./geo-math";
import type { LiveTrackingSnapshot, TrackingSessionConfig, TrackingStep } from "./types";

const TICK_MS = 2000;
const timers = new Map<string, ReturnType<typeof setInterval>>();

function stepTargetProgress(step: TrackingStep): { min: number; max: number; speed: number } {
  switch (step) {
    case "pickup":
      return { min: 0, max: 0.12, speed: 0.008 };
    case "transit":
      return { min: 0.12, max: 0.88, speed: 0.014 };
    case "dropoff":
      return { min: 0.88, max: 0.98, speed: 0.006 };
    default:
      return { min: 0, max: 1, speed: 0.01 };
  }
}

function publish(snapshot: LiveTrackingSnapshot): void {
  setLiveTracking(snapshot);
}

async function buildSnapshot(
  config: TrackingSessionConfig,
  route: { lat: number; lng: number }[],
  progress: number,
  gpsLive?: boolean,
): Promise<LiveTrackingSnapshot> {
  const driverPos = pointAlongRoute(route, progress);
  const next = pointAlongRoute(route, Math.min(progress + 0.02, 1));
  return {
    trackingId: config.trackingId,
    pickup: config.pickup,
    dropoff: config.dropoff,
    driver: {
      ...driverPos,
      heading: bearingDeg(driverPos, next),
    },
    route,
    progress,
    etaMinutes: etaMinutesFromRoute(route, progress),
    step: config.step,
    driverName: config.driverName,
    updatedAt: new Date().toISOString(),
    gpsLive,
  };
}

export async function startLiveTracking(config: TrackingSessionConfig): Promise<void> {
  stopLiveTracking(config.trackingId);

  const route = await fetchDrivingRoute(config.pickup, config.dropoff);
  const { min } = stepTargetProgress(config.step);
  const snapshot = await buildSnapshot(config, route, min);
  publish(snapshot);

  const tick = () => {
    const current = getLiveTracking(config.trackingId);
    if (!current) return;

    if (current.gpsLive) return;

    const { min: pMin, max: pMax, speed } = stepTargetProgress(current.step);
    let nextProgress = current.progress + speed;
    if (nextProgress < pMin) nextProgress = pMin;
    if (nextProgress > pMax) nextProgress = pMax;

    const driverPos = pointAlongRoute(current.route, nextProgress);
    const nextPt = pointAlongRoute(current.route, Math.min(nextProgress + 0.02, 1));

    publish({
      ...current,
      progress: nextProgress,
      driver: { ...driverPos, heading: bearingDeg(driverPos, nextPt) },
      etaMinutes: etaMinutesFromRoute(current.route, nextProgress),
      updatedAt: new Date().toISOString(),
    });
  };

  timers.set(config.trackingId, setInterval(tick, TICK_MS));
}

export function updateTrackingStep(trackingId: string, step: TrackingStep): void {
  const current = getLiveTracking(trackingId);
  if (!current) return;
  const { min } = stepTargetProgress(step);
  publish({
    ...current,
    step,
    progress: Math.max(current.progress, min),
    updatedAt: new Date().toISOString(),
  });
}

export function updateDriverGps(trackingId: string, lat: number, lng: number): void {
  const current = getLiveTracking(trackingId);
  if (!current) return;

  let closest = 0;
  let best = Infinity;
  current.route.forEach((p, i) => {
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < best) {
      best = d;
      closest = i;
    }
  });
  const progress = closest / Math.max(current.route.length - 1, 1);
  const prev = current.driver;
  const heading =
    Math.abs(prev.lat - lat) > 0.00001 ? bearingDeg(prev, { lat, lng }) : prev.heading;

  publish({
    ...current,
    driver: { lat, lng, heading },
    progress,
    etaMinutes: etaMinutesFromRoute(current.route, progress),
    gpsLive: true,
    updatedAt: new Date().toISOString(),
  });
}

export function stopLiveTracking(trackingId: string): void {
  const t = timers.get(trackingId);
  if (t) {
    clearInterval(t);
    timers.delete(trackingId);
  }
}

export function stopAndClearTracking(trackingId: string): void {
  stopLiveTracking(trackingId);
  removeLiveTracking(trackingId);
}
