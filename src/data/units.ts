import { useSyncExternalStore } from "react";
import { createStore } from "./persist";
import type { MarketUnit } from "@/lib/market/types";

// Unités de vente utilisées par les produits : celles de la base en mode
// serveur (avec leur nombre de produits), vide en démonstration (le
// formulaire se sert alors des produits locaux).

const unitsStore = createStore<MarketUnit[]>([]);

export function useUnits(): MarketUnit[] {
  return useSyncExternalStore(unitsStore.subscribe, unitsStore.get, unitsStore.get);
}

export function getUnits(): MarketUnit[] {
  return unitsStore.get();
}

/** Mode serveur : la liste de la base. */
export function replaceUnits(list: MarketUnit[]) {
  unitsStore.replace(list);
}
