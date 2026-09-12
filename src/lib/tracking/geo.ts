import type { TrackingPoint } from "./types";

/** Coordonnées approximatives des principales villes du Sénégal. */
const KNOWN_CITIES: Record<string, TrackingPoint> = {
  Dakar: { lat: 14.7167, lng: -17.4677 },
  Thiès: { lat: 14.7886, lng: -16.9246 },
  "Saint-Louis": { lat: 16.0179, lng: -16.4896 },
  Kaolack: { lat: 14.1652, lng: -16.0726 },
  Ziguinchor: { lat: 12.5833, lng: -16.2719 },
  Touba: { lat: 14.8667, lng: -15.8833 },
  Mbour: { lat: 14.4198, lng: -16.9646 },
  Louga: { lat: 15.6144, lng: -16.2264 },
};

/**
 * Résout des coordonnées approchées pour une ville nommée. Les villes
 * connues renvoient des coordonnées réelles ; les autres (ex. quartiers
 * comme "Dakar-Pikine", "Dakar Plateau") retombent sur la ville principale
 * qu'elles contiennent, puis sur une position déterministe (même ville =
 * toujours la même position) si rien ne correspond.
 */
export function cityCoords(cityOrArea: string): TrackingPoint {
  const direct = KNOWN_CITIES[cityOrArea];
  if (direct) return direct;

  const contained = Object.entries(KNOWN_CITIES).find(([name]) =>
    cityOrArea.toLowerCase().includes(name.toLowerCase()),
  );
  if (contained) return contained[1];

  let h = 0;
  for (const ch of cityOrArea) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return { lat: 12.5 + (h % 400) / 100, lng: -17.5 + (h % 300) / 100 };
}
