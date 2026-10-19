import { useMarketMode } from "./market-mode";

// Écrans dont les données ne vivent que dans le navigateur (démonstration) :
// avec la base de données, rien n'y serait enregistré ni partagé. Ils sont
// donc masqués des menus et remplacés par un message tant qu'ils ne sont pas
// reliés au serveur.

// Tous les écrans sont aujourd'hui reliés à la base : la liste est vide, le
// mécanisme reste pour un futur écran de démonstration.
export const DEMO_ONLY_PREFIXES: string[] = [];

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
