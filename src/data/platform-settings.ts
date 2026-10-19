import { useSyncExternalStore } from "react";
import { commissionTiers as seedTiers, deliveryZones as seedZones } from "./admin-mocks";
import { createStore } from "./persist";

// Réglages de la plateforme modifiés par l'admin (barème de commission,
// zones et frais de livraison), dans un module sans dépendance vers les
// autres magasins : le calcul des commandes et des revenus peut ainsi lire
// les valeurs RÉELLES réglées par l'admin, pas les valeurs de démo figées.

export type CommissionTier = (typeof seedTiers)[number];
export type DeliveryZone = (typeof seedZones)[number];

export const tiersStore = createStore<CommissionTier[]>(seedTiers, "diambar:admin-tiers");
export const zonesStore = createStore<DeliveryZone[]>(seedZones, "diambar:admin-zones");

export function getCommissionTiers() {
  return tiersStore.get();
}
export function getDeliveryZones() {
  return zonesStore.get();
}
export function useCommissionTiers() {
  return useSyncExternalStore(tiersStore.subscribe, tiersStore.get, tiersStore.get);
}
export function useDeliveryZones() {
  return useSyncExternalStore(zonesStore.subscribe, zonesStore.get, zonesStore.get);
}

const fcfa = (n: number) => n.toLocaleString("fr-FR").replace(/\u202f/g, " ");

/** Barème lu en base : même forme que celui de la démonstration. */
export function replaceCommissionTiers(
  list: { label: string; rate: number; min: number; max: number | null }[],
) {
  tiersStore.replace(
    list.map((t, i) => ({
      id: `tier${i + 1}`,
      label: t.label,
      range:
        t.max === null
          ? `> ${fcfa(t.min - 1 > 0 ? t.min - 1 : t.min)} FCFA / mois`
          : `${fcfa(t.min)} – ${fcfa(t.max)} FCFA / mois`,
      rate: t.rate,
      min: t.min,
      max: t.max,
    })),
  );
}
