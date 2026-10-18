import { useMarketMode } from "./market-mode";

// Écrans dont les données ne vivent que dans le navigateur (démonstration) :
// avec la base de données, rien n'y serait enregistré ni partagé. Ils sont
// donc masqués des menus et remplacés par un message tant qu'ils ne sont pas
// reliés au serveur.

export const DEMO_ONLY_PREFIXES = [
  // Restaurant
  "/restaurant/returns",
  "/restaurant/reviews",
  "/restaurant/suppliers",
  "/restaurant/compare",
  "/restaurant/settings/team",
  // Producteur
  "/farmer/returns",
  "/farmer/settings/team",
  // Livreur
  "/driver/routes",
  "/driver/incidents",
  "/driver/vehicle",
  "/driver/settings/work",
  "/driver/settings/privacy",
  // Administration
  "/admin/returns",
  "/admin/incidents",
  "/admin/moderation",
  "/admin/documents",
  "/admin/refunds",
];

export function isDemoOnlyPath(path: string): boolean {
  return DEMO_ONLY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Vrai quand l'écran (ou le lien) doit être masqué : données en base. */
export function useHiddenInBase(): (path: string) => boolean {
  const { remote } = useMarketMode();
  return (path) => remote && isDemoOnlyPath(path);
}

/** Vrai en mode base (pour masquer un bloc ou un bouton précis). */
export function useBaseMode(): boolean {
  return useMarketMode().remote;
}
