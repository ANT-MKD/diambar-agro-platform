import { useSyncExternalStore } from "react";
import { createStore } from "./persist";
import { cleanCategoryName, sameCategory } from "@/lib/category-name";
import type { MarketCategory } from "@/lib/market/types";

// Catégories de produits, une seule liste pour toute l'application
// (formulaire produit, import, filtres du marché…) : celle de la base en mode
// serveur, celle de la démonstration sinon.

export const DEFAULT_CATEGORY_NAMES = [
  "Légumes",
  "Fruits",
  "Viande",
  "Volaille",
  "Céréales",
  "Tubercules",
  "Épices",
];

const categoriesStore = createStore<MarketCategory[]>(
  DEFAULT_CATEGORY_NAMES.map((name) => ({
    id: name,
    name,
    status: "approved" as const,
    productCount: 0,
  })),
  "diambar:categories",
);

export function useCategories(): MarketCategory[] {
  return useSyncExternalStore(categoriesStore.subscribe, categoriesStore.get, categoriesStore.get);
}

/** Noms des catégories, dans l'ordre d'affichage (les propositions à la
 * fin), plus celles des produits donnés qui manqueraient à la liste. */
export function useCategoryNames(productCategories: string[] = []): string[] {
  const names = useCategories().map((c) => c.name);
  const extra = [...new Set(productCategories)].filter((c) => c && !names.includes(c));
  return [...names, ...extra];
}

export function getCategories(): MarketCategory[] {
  return categoriesStore.get();
}

/** Mode serveur : la liste de la base. */
export function replaceCategories(list: MarketCategory[]) {
  categoriesStore.replace(list);
}

/** Démonstration : nom canonique d'une catégorie, créée (proposée) si elle
 * n'existe pas encore. En mode serveur, c'est le serveur qui décide. */
export function ensureLocalCategory(name: string): string {
  const list = categoriesStore.get();
  const found = sameCategory(name, list);
  if (found) return found.name;
  const clean = cleanCategoryName(name);
  categoriesStore.set([...list, { id: clean, name: clean, status: "proposed", productCount: 1 }]);
  return clean;
}
