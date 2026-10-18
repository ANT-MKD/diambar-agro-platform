import type { Mission } from "@/data/mocks";
import { cityCoords } from "@/lib/tracking/geo";
import { haversineKm } from "@/lib/tracking/geo-math";
import { DEFAULT_DRIVER_PAY, type DriverPay } from "@/lib/platform-rules";

// Calculs d'une course de livraison, partagés par le navigateur (mode démo)
// et par le serveur (commandes en base) : mêmes règles des deux côtés.

/** Véhicule d'une course selon le poids, seuils réglés par l'admin. */
export function vehicleForWeight(
  kg: number,
  pay: DriverPay = DEFAULT_DRIVER_PAY,
): Mission["vehicleType"] {
  if (kg > pay.vanMaxKg) return "Camion";
  if (kg > pay.motoMaxKg) return "Camionnette";
  return "Moto";
}

// Rémunération d'une course : une prise en charge fixe, la distance et le
// poids transporté, avec un minimum (réglés par l'admin dans « Tarifs de
// livraison »).
export const MISSION_PAY = {
  base: DEFAULT_DRIVER_PAY.base,
  perKm: DEFAULT_DRIVER_PAY.perKm,
  perKgOver20: DEFAULT_DRIVER_PAY.perKgOver,
  minimum: DEFAULT_DRIVER_PAY.minimum,
};

export function missionPayout(
  distanceKm: number,
  weightKg: number,
  pay: DriverPay = DEFAULT_DRIVER_PAY,
): number {
  const raw =
    pay.base + distanceKm * pay.perKm + Math.max(0, weightKg - pay.freeKg) * pay.perKgOver;
  return Math.max(pay.minimum, Math.round(raw / 50) * 50);
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
