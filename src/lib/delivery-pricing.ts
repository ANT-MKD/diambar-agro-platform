import { driverCommissionForPayout } from "@/lib/commission";
import { missionPayout } from "@/lib/mission-pay";
import { DEFAULT_DRIVER_PAY, type DriverPay } from "@/lib/platform-rules";
import type { Coords } from "@/lib/places";
import { haversineKm } from "@/lib/tracking/geo-math";

// Frais de livraison payés par le restaurant, selon la distance entre le
// producteur et le restaurant (et le poids). La même distance sert à la paie
// du livreur : elle est calculée une fois, à la commande, et enregistrée.
// Partagé par le serveur (qui fait foi) et l'écran (qui l'affiche avant de
// payer).

export type DeliveryPricing = {
  /** Tranches de distance, dans l'ordre : frais fixes jusqu'à upToKm. */
  brackets: { upToKm: number; fee: number }[];
  /** Au-delà de la dernière tranche : par km supplémentaire. */
  beyondPerKm: number;
  /** Supplément par kg au-delà de freeKg. */
  perKgOver: number;
  freeKg: number;
  /** Ligne droite × ce coefficient ≈ distance par la route. */
  roadFactor: number;
  /** Jamais moins que ce que coûte la course (paie du livreur − commission). */
  floorToCost: boolean;
};

export const DEFAULT_DELIVERY_PRICING: DeliveryPricing = {
  brackets: [
    { upToKm: 5, fee: 1500 },
    { upToKm: 10, fee: 2000 },
    { upToKm: 20, fee: 3000 },
    { upToKm: 40, fee: 5000 },
  ],
  beyondPerKm: 150,
  perKgOver: 10,
  freeKg: 20,
  roadFactor: 1.3,
  floorToCost: true,
};

/** Réglage enregistré, complété par les valeurs par défaut. */
export function normalizePricing(v: unknown): DeliveryPricing {
  const d = DEFAULT_DELIVERY_PRICING;
  const x = (v ?? {}) as Partial<DeliveryPricing>;
  const num = (n: unknown, def: number, min = 0) =>
    typeof n === "number" && Number.isFinite(n) && n >= min ? n : def;
  const brackets = Array.isArray(x.brackets)
    ? x.brackets
        .filter((b) => num(b?.upToKm, -1) > 0 && num(b?.fee, -1) >= 0)
        .map((b) => ({ upToKm: b.upToKm, fee: Math.round(b.fee) }))
        .sort((a, b) => a.upToKm - b.upToKm)
    : [];
  return {
    brackets: brackets.length ? brackets : d.brackets,
    beyondPerKm: num(x.beyondPerKm, d.beyondPerKm),
    perKgOver: num(x.perKgOver, d.perKgOver),
    freeKg: num(x.freeKg, d.freeKg),
    roadFactor: num(x.roadFactor, d.roadFactor, 1),
    floorToCost: typeof x.floorToCost === "boolean" ? x.floorToCost : d.floorToCost,
  };
}

/** Distance estimée par la route, en km entiers (au moins 1). */
export function estimateDistanceKm(
  from: Coords,
  to: Coords,
  roadFactor: number,
  adjustKm = 0,
): number {
  return Math.max(1, Math.round(haversineKm(from, to) * roadFactor + adjustKm));
}

/** Ce que la course coûte à la plateforme : paie du livreur − sa commission. */
export function driverNetCost(
  distanceKm: number,
  weightKg: number,
  pay: DriverPay = DEFAULT_DRIVER_PAY,
): number {
  const payout = missionPayout(distanceKm, weightKg, pay);
  return payout - driverCommissionForPayout(payout, pay.commissionRate);
}

const up50 = (n: number) => Math.ceil(n / 50) * 50;

export function bracketLabel(distanceKm: number, p: DeliveryPricing): string {
  let from = 0;
  for (const b of p.brackets) {
    if (distanceKm <= b.upToKm) return `${from} à ${b.upToKm} km`;
    from = b.upToKm;
  }
  return `Plus de ${from} km`;
}

export type DeliveryQuote = {
  distanceKm: number;
  fee: number;
  bracket: string;
  /** Frais relevés au coût de la course (garde-fou). */
  floored: boolean;
};

export function deliveryFee(
  distanceKm: number,
  weightKg: number,
  p: DeliveryPricing,
  pay: DriverPay = DEFAULT_DRIVER_PAY,
): DeliveryQuote {
  const last = p.brackets[p.brackets.length - 1];
  const inBracket = p.brackets.find((b) => distanceKm <= b.upToKm);
  const base = inBracket
    ? inBracket.fee
    : last.fee + Math.ceil(distanceKm - last.upToKm) * p.beyondPerKm;
  const weight = Math.max(0, Math.ceil(weightKg - p.freeKg)) * p.perKgOver;
  let fee = up50(base + weight);
  let floored = false;
  if (p.floorToCost) {
    const cost = driverNetCost(distanceKm, weightKg, pay);
    if (fee < cost) {
      fee = up50(cost);
      floored = true;
    }
  }
  return { distanceKm, fee, bracket: bracketLabel(distanceKm, p), floored };
}

// Lignes de l'écran admin « Tarifs de livraison ».

export type PlaceRow = {
  id: string;
  kind: "city" | "zone";
  name: string;
  cityName: string;
  active: boolean;
  lat: number | null;
  lng: number | null;
  /** D'où vient la position utilisée. */
  source: "admin" | "reference" | null;
};

export type FarmerPlaceRow = {
  id: string;
  farmName: string;
  pickupAddress: string;
  origin: string | null;
  lat: number | null;
  lng: number | null;
  adjustKm: number;
};
