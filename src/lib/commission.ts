import type { Order } from "@/data/mocks";

type Tier = { min: number; max: number | null; rate: number };

export function tierRateForVolume(tiers: Tier[], volume: number) {
  const tier = tiers.find((t) => volume >= t.min && (t.max === null || volume <= t.max));
  return (tier ?? tiers[tiers.length - 1])?.rate ?? 0;
}

/**
 * Volume livré cumulé par producteur, base du barème dégressif réel
 * (/admin/settings). Le jeu de démo ne couvre que quelques jours, pas un
 * mois complet : on agrège tout l'historique disponible en guise de volume
 * mensuel plutôt que de trancher par mois calendaire.
 */
export function deliveredVolumeByFarmer(orders: Order[]) {
  const byFarmer = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "delivered") continue;
    byFarmer.set(o.farmerId, (byFarmer.get(o.farmerId) ?? 0) + o.total);
  }
  return byFarmer;
}

export function commissionRateForOrder(
  order: Order,
  tiers: Tier[],
  volumeByFarmer: Map<string, number>,
) {
  const volume = volumeByFarmer.get(order.farmerId) ?? order.total;
  return tierRateForVolume(tiers, volume);
}

export function commissionForOrder(
  order: Order,
  tiers: Tier[],
  volumeByFarmer: Map<string, number>,
) {
  return Math.round(order.total * (commissionRateForOrder(order, tiers, volumeByFarmer) / 100));
}

/**
 * Commission plateforme sur un montant partiel (ex. un remboursement),
 * au même taux réel que celui appliqué à la commande d'origine — pas un
 * pourcentage recalculé ou codé en dur pour l'occasion.
 */
export function commissionForAmount(
  order: Order,
  tiers: Tier[],
  volumeByFarmer: Map<string, number>,
  amount: number,
) {
  return Math.round(amount * (commissionRateForOrder(order, tiers, volumeByFarmer) / 100));
}

export function computeCommission(orders: Order[], tiers: Tier[]) {
  const volumeByFarmer = deliveredVolumeByFarmer(orders);
  return orders
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + commissionForOrder(o, tiers, volumeByFarmer), 0);
}

/**
 * Commission plateforme sur une mission de livraison : taux fixe (le
 * livreur conserve 80 % de la course, cf. page /pricing), pas de barème par
 * palier comme pour les producteurs.
 */
export const DRIVER_COMMISSION_RATE = 20;

export function driverCommissionForPayout(payout: number) {
  return Math.round(payout * (DRIVER_COMMISSION_RATE / 100));
}
