import { categoryKey } from "./category-name";

// Unités de vente des produits : une liste de base, plus celles que les
// producteurs écrivent eux-mêmes (« Autre unité »). Une unité saisie
// autrement qu'une unité existante (« Sacs », « SAC ») reprend l'existante.

export const BASE_UNITS = ["kg", "litre", "unité", "botte", "sac"];

/** Suggestions proposées en plus de la liste de base. */
export const SUGGESTED_UNITS = ["cagette", "tas", "douzaine", "régime", "plateau", "pot"];

/** Clé de comparaison (mêmes règles que les catégories : sans accents ni pluriel). */
export const unitKey = (unit: string) => categoryKey(unit);

/** Unité telle qu'enregistrée : minuscules, espaces réduits. */
export function cleanUnit(unit: string): string {
  return unit.replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");
}

/** Problème de l'unité saisie, ou null si elle est acceptable. */
export function unitProblem(unit: string): string | null {
  const u = cleanUnit(unit);
  if (!u) return "Indiquez l'unité de vente.";
  if (u.length > 20) return "Unité trop longue (20 caractères maximum).";
  if (!/^[\p{L}0-9][\p{L}0-9 '’.,/-]*$/u.test(u)) {
    return "L'unité ne peut contenir que des lettres, des chiffres et de la ponctuation simple.";
  }
  return null;
}

/** Unité existante équivalente, ou l'unité nettoyée si elle est nouvelle. */
export function canonicalUnit(unit: string, existing: string[]): string {
  const key = unitKey(unit);
  return existing.find((u) => unitKey(u) === key) ?? cleanUnit(unit);
}

/** Liste des unités à proposer : la base, celles déjà utilisées, puis les
 * suggestions, sans doublon. */
export function unitChoices(inUse: string[] = []): string[] {
  const out: string[] = [];
  for (const u of [...BASE_UNITS, ...inUse, ...SUGGESTED_UNITS]) {
    const clean = cleanUnit(u);
    if (clean && !out.some((x) => unitKey(x) === unitKey(clean))) out.push(clean);
  }
  return out;
}
