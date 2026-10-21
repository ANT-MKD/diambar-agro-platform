import type { TrackingPoint } from "./types";

const ROUTE_CACHE = new Map<string, TrackingPoint[]>();

function cacheKey(a: TrackingPoint, b: TrackingPoint): string {
  return `${a.lat.toFixed(4)},${a.lng.toFixed(4)}-${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
}

// Démonstration seulement (trajets simulés, sans base de données). Le serveur
// OSRM public n'accepte pas d'usage commercial : VITE_ROUTING_URL désigne un
// serveur OSRM à soi si besoin.
const OSRM_URL = (
  (import.meta.env as Record<string, string | undefined>).VITE_ROUTING_URL?.trim() ||
  "https://router.project-osrm.org"
).replace(/\/+$/, "");

/** Itinéraire routier via OSRM (démonstration). */
export async function fetchDrivingRoute(
  from: TrackingPoint,
  to: TrackingPoint,
): Promise<TrackingPoint[]> {
  const key = cacheKey(from, to);
  const cached = ROUTE_CACHE.get(key);
  if (cached) return cached;

  try {
    const sessionKey = `osrm-${key}`;
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) {
      const parsed = JSON.parse(stored) as TrackingPoint[];
      ROUTE_CACHE.set(key, parsed);
      return parsed;
    }

    const url = `${OSRM_URL}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM error");
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) throw new Error("No route");

    const route: TrackingPoint[] = coords.map(([lng, lat]) => ({ lat, lng }));
    ROUTE_CACHE.set(key, route);
    sessionStorage.setItem(sessionKey, JSON.stringify(route));
    return route;
  } catch {
    const fallback = interpolateStraight(from, to, 24);
    ROUTE_CACHE.set(key, fallback);
    return fallback;
  }
}

function interpolateStraight(
  from: TrackingPoint,
  to: TrackingPoint,
  steps: number,
): TrackingPoint[] {
  const pts: TrackingPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat: from.lat + (to.lat - from.lat) * t,
      lng: from.lng + (to.lng - from.lng) * t,
    });
  }
  return pts;
}
