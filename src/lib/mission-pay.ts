import type { Mission } from "@/data/mocks";
import { cityCoords } from "@/lib/tracking/geo";
import { haversineKm } from "@/lib/tracking/geo-math";

// Calculs d'une course de livraison, partagés par le navigateur (mode démo)
// et par le serveur (commandes en base) : mêmes règles des deux côtés.

export function vehicleForWeight(kg: number): Mission["vehicleType"] {
  if (kg > 80) return "Camion";
  if (kg > 30) return "Camionnette";
  return "Moto";
}

// Rémunération d'une course : une prise en charge fixe, la distance et le
// poids transporté. Avant, seule la distance comptait (120 FCFA/km) : une
// course dans la même ville était payée 100 FCFA.
export const MISSION_PAY = { base: 1000, perKm: 120, perKgOver20: 10, minimum: 1500 };

export function missionPayout(distanceKm: number, weightKg: number): number {
  const raw =
    MISSION_PAY.base +
    distanceKm * MISSION_PAY.perKm +
    Math.max(0, weightKg - 20) * MISSION_PAY.perKgOver20;
  return Math.max(MISSION_PAY.minimum, Math.round(raw / 50) * 50);
}

/** "Le Baobab, Dakar Plateau" -> "Dakar Plateau" (même règle que la
 * résolution de suivi en direct, pour rester cohérent avec elle). */
export function lastAddressSegment(address: string): string {
  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() || address;
}

/** Distance (km, arrondie, au moins 1) et durée estimée entre deux villes. */
export function routeEstimate(fromCity: string, toCity: string) {
  const distanceKm = Math.max(1, Math.round(haversineKm(cityCoords(fromCity), cityCoords(toCity))));
  const estimatedMinutes = Math.max(10, Math.round((distanceKm / 42) * 60));
  return { distanceKm, estimatedMinutes };
}

/** Urgence d'une course : prioritaire si la livraison est dans moins de 36 h. */
export function urgencyForSlot(slotStart: string | Date | undefined, now = Date.now()) {
  if (!slotStart) return "standard" as const;
  return new Date(slotStart).getTime() - now < 36 * 3600_000
    ? ("priority" as const)
    : ("standard" as const);
}
