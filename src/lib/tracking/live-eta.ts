import { haversineKm } from "./geo-math";

/** Détours de la route par rapport au vol d'oiseau. */
const ROAD_FACTOR = 1.3;
/** Vitesses moyennes : en ville sur les premiers kilomètres, sur route au-delà. */
const CITY_KM = 8;
const CITY_SPEED_KMH = 20;
const ROAD_SPEED_KMH = 50;

export function agoLabel(ms: number): string {
  if (ms < 15_000) return "à l'instant";
  if (ms < 60_000) return `il y a ${Math.round(ms / 1000)} s`;
  const min = Math.round(ms / 60_000);
  return `il y a ${min} min`;
}

/** Durée estimée jusqu'au prochain arrêt (minutes), à partir de la distance à vol d'oiseau. */
export function estimateMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const km = haversineKm(from, to) * ROAD_FACTOR;
  const hours = Math.min(km, CITY_KM) / CITY_SPEED_KMH + Math.max(0, km - CITY_KM) / ROAD_SPEED_KMH;
  return Math.max(1, Math.round(hours * 60));
}
