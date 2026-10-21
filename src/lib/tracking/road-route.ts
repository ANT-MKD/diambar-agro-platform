import { haversineKm } from "./geo-math";
import type { TrackingPoint } from "./types";

// Itinéraire routier jusqu'au prochain arrêt (Mapbox Directions, avec le
// trafic quand Mapbox en a). Quota gratuit limité : un calcul est réutilisé
// tant que le livreur reste sur la route ; on ne recalcule que si l'arrêt
// change ou s'il s'en écarte.

export type RoadRoute = {
  points: TrackingPoint[];
  distanceKm: number;
  durationMin: number;
  /** Arrêt visé par ce calcul. */
  to: TrackingPoint;
};

/** Écart au-delà duquel le livreur a quitté l'itinéraire (km). */
const OFF_ROUTE_KM = 0.15;
/** L'arrêt a changé s'il a bougé de plus de 30 m. */
const SAME_STOP_KM = 0.03;

export async function fetchRoadRoute(
  from: TrackingPoint,
  to: TrackingPoint,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RoadRoute | null> {
  const coords = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    routes?: {
      geometry?: { coordinates?: [number, number][] };
      distance?: number;
      duration?: number;
    }[];
  };
  const r = data.routes?.[0];
  const line = r?.geometry?.coordinates;
  if (!r || !line || line.length < 2) return null;
  return {
    points: line.map(([lng, lat]) => ({ lat, lng })),
    distanceKm: (r.distance ?? 0) / 1000,
    durationMin: (r.duration ?? 0) / 60,
    to,
  };
}

/** Distance (km) d'un point au plus proche segment de l'itinéraire. */
export function distanceToRouteKm(p: TrackingPoint, points: TrackingPoint[]): number {
  if (!points.length) return Infinity;
  // Projection locale (quelques km) : assez précise à cette échelle.
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = (points[i].lng - p.lng) * kx;
    const ay = (points[i].lat - p.lat) * ky;
    const bx = (points[i + 1].lng - p.lng) * kx;
    const by = (points[i + 1].lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  if (points.length === 1) best = haversineKm(p, points[0]);
  return best;
}

/** Faut-il (re)calculer l'itinéraire ? */
export function needsReroute(
  route: RoadRoute | null,
  from: TrackingPoint,
  to: TrackingPoint,
): boolean {
  if (!route) return true;
  if (haversineKm(route.to, to) > SAME_STOP_KM) return true;
  return distanceToRouteKm(from, route.points) > OFF_ROUTE_KM;
}

/**
 * Reste du trajet depuis la position du livreur : la partie déjà faite est
 * retirée, et la durée réduite d'autant.
 */
export function remainingRoute(
  route: RoadRoute,
  from: TrackingPoint,
): { points: TrackingPoint[]; durationMin: number } {
  const pts = route.points;
  let nearest = 0;
  let bestKm = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = haversineKm(from, pts[i]);
    if (d < bestKm) {
      bestKm = d;
      nearest = i;
    }
  }
  const rest = [from, ...pts.slice(nearest + 1)];
  let restKm = 0;
  for (let i = 1; i < rest.length; i++) restKm += haversineKm(rest[i - 1], rest[i]);
  const ratio = route.distanceKm > 0 ? Math.min(1, restKm / route.distanceKm) : 1;
  return { points: rest, durationMin: route.durationMin * ratio };
}
