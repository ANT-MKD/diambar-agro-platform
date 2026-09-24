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
