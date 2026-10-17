// Noms de catégories de produits : une catégorie proposée par un producteur
// ne doit pas doubler une catégorie existante écrite autrement (« légumes »,
// « Legume », « LÉGUMES »).

/** Clé de comparaison : minuscules, sans accents ni pluriel, espaces réduits. */
export function categoryKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/(s|x)$/, "") : w))
    .join(" ");
}

/** Nom tel qu'enregistré : espaces réduits, première lettre en majuscule. */
export function cleanCategoryName(name: string): string {
  const s = name.replace(/\s+/g, " ").trim();
  return s.charAt(0).toLocaleUpperCase("fr") + s.slice(1);
}

/** Problème du nom proposé, ou null s'il est acceptable. */
export function categoryNameProblem(name: string): string | null {
  const s = cleanCategoryName(name);
  if (s.length < 3) return "Nom de catégorie trop court (3 caractères minimum).";
  if (s.length > 40) return "Nom de catégorie trop long (40 caractères maximum).";
  if (!/^[\p{L}0-9][\p{L}0-9 '’&,.()-]*$/u.test(s)) {
    return "Le nom de catégorie ne peut contenir que des lettres, des chiffres et de la ponctuation simple.";
  }
  return null;
}

/** Catégorie existante équivalente (même clé), si elle existe. */
export function sameCategory<T extends { name: string }>(name: string, list: T[]): T | null {
  const key = categoryKey(name);
  return key ? (list.find((c) => categoryKey(c.name) === key) ?? null) : null;
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Catégories proches du nom saisi (faute de frappe, nom contenu dans
 * l'autre), à proposer avant d'en créer une nouvelle. `typosOnly` : fautes
 * de frappe seulement (« Fruits de mer » n'est pas une faute pour « Fruits »). */
export function similarCategories<T extends { name: string }>(
  name: string,
  list: T[],
  max = 3,
  { typosOnly = false }: { typosOnly?: boolean } = {},
): T[] {
  const key = categoryKey(name);
  if (key.length < 3) return [];
  return list
    .map((c) => {
      const k = categoryKey(c.name);
      const close =
        k === key ||
        (!typosOnly && key.length >= 4 && (k.includes(key) || key.includes(k))) ||
        (key.length >= 4 && distance(k, key) <= (key.length >= 8 ? 2 : 1));
      return { c, close, d: distance(k, key) };
    })
    .filter((x) => x.close)
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map((x) => x.c);
}
