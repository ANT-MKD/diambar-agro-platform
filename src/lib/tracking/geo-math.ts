import type { TrackingPoint } from "./types";

const R_KM = 6371;

export function haversineKm(a: TrackingPoint, b: TrackingPoint): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function bearingDeg(from: TrackingPoint, to: TrackingPoint): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function pointAlongRoute(route: TrackingPoint[], progress: number): TrackingPoint {
  if (route.length === 0) return { lat: 0, lng: 0 };
  if (route.length === 1 || progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];

  const total = route.reduce((acc, p, i) => (i === 0 ? 0 : acc + haversineKm(route[i - 1], p)), 0);
  const target = total * progress;
  let walked = 0;

  for (let i = 1; i < route.length; i++) {
    const seg = haversineKm(route[i - 1], route[i]);
    if (walked + seg >= target) {
      const t = seg > 0 ? (target - walked) / seg : 0;
      return {
        lat: route[i - 1].lat + (route[i].lat - route[i - 1].lat) * t,
        lng: route[i - 1].lng + (route[i].lng - route[i - 1].lng) * t,
      };
    }
    walked += seg;
  }
  return route[route.length - 1];
}

export function etaMinutesFromRoute(
  route: TrackingPoint[],
  progress: number,
  speedKmH = 42,
): number {
  const idx = Math.floor(progress * (route.length - 1));
  let dist = 0;
  for (let i = idx; i < route.length - 1; i++) {
    dist += haversineKm(route[i], route[i + 1]);
  }
  const current = pointAlongRoute(route, progress);
  if (idx < route.length - 1) {
    dist += haversineKm(current, route[Math.min(idx + 1, route.length - 1)]);
  }
  return Math.max(1, Math.round((dist / speedKmH) * 60));
}
