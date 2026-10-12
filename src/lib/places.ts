// Positions de référence des villes et quartiers (calcul des distances de
// livraison). Approximatives, à un kilomètre près : l'admin peut corriger
// chaque ville ou quartier (Tarifs de livraison), et la position enregistrée
// en base passe alors avant celle-ci. Un lieu absent n'est jamais deviné.

export type Coords = { lat: number; lng: number };

export const REFERENCE_PLACES: Record<string, Coords> = {
  // Dakar, quartier par quartier
  Plateau: { lat: 14.6693, lng: -17.4373 },
  Médina: { lat: 14.6824, lng: -17.4486 },
  "Fann – Point E – Amitié": { lat: 14.692, lng: -17.463 },
  Fann: { lat: 14.6895, lng: -17.4645 },
  "Point E": { lat: 14.6935, lng: -17.4605 },
  "Mermoz – Sacré-Cœur": { lat: 14.7085, lng: -17.474 },
  Mermoz: { lat: 14.7085, lng: -17.474 },
  "Sacré-Cœur": { lat: 14.7165, lng: -17.4655 },
  Ouakam: { lat: 14.723, lng: -17.49 },
  Ngor: { lat: 14.748, lng: -17.513 },
  Almadies: { lat: 14.744, lng: -17.523 },
  Yoff: { lat: 14.756, lng: -17.47 },
  "Grand Yoff": { lat: 14.735, lng: -17.454 },
  "Parcelles Assainies": { lat: 14.764, lng: -17.442 },
  HLM: { lat: 14.711, lng: -17.447 },
  Pikine: { lat: 14.755, lng: -17.392 },
  Guédiawaye: { lat: 14.779, lng: -17.396 },
  "Keur Massar": { lat: 14.783, lng: -17.312 },
  Thiaroye: { lat: 14.748, lng: -17.353 },
  Mbao: { lat: 14.736, lng: -17.326 },
  Rufisque: { lat: 14.716, lng: -17.273 },
  Bargny: { lat: 14.697, lng: -17.224 },
  Diamniadio: { lat: 14.719, lng: -17.184 },
  Sébikotane: { lat: 14.746, lng: -17.136 },
  Sangalkam: { lat: 14.788, lng: -17.226 },
  Bayakh: { lat: 14.862, lng: -17.118 },
  Kayar: { lat: 14.92, lng: -17.118 },
  Dakar: { lat: 14.6928, lng: -17.4467 },
  // Bassins de production et autres villes
  Pout: { lat: 14.772, lng: -17.057 },
  Thiès: { lat: 14.7886, lng: -16.9246 },
  Khombole: { lat: 14.77, lng: -16.697 },
  Tivaouane: { lat: 14.95, lng: -16.817 },
  Mbour: { lat: 14.42, lng: -16.965 },
  Saly: { lat: 14.448, lng: -17.017 },
  Fatick: { lat: 14.339, lng: -16.411 },
  Diourbel: { lat: 14.655, lng: -16.234 },
  Touba: { lat: 14.8667, lng: -15.8833 },
  Kaolack: { lat: 14.1652, lng: -16.0726 },
  Louga: { lat: 15.6144, lng: -16.2264 },
  "Saint-Louis": { lat: 16.0179, lng: -16.4896 },
  Ziguinchor: { lat: 12.5833, lng: -16.2719 },
};

export function normPlace(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lieu connu dans un texte (nom ou adresse) : d'abord le nom exact, puis
 * la fin de l'adresse (« …, Thiès »), puis le nom connu le plus long cité.
 * `wide: false` : un nom trop large (Dakar) ne compte que s'il est exact
 * (« Dakar Nord » n'est pas situé au centre de Dakar). */
export function findPlace(
  text: string | null | undefined,
  places: Record<string, Coords> = REFERENCE_PLACES,
  { wide = true }: { wide?: boolean } = {},
): (Coords & { name: string }) | null {
  if (!text?.trim()) return null;
  const entries = Object.entries(places).map(([name, c]) => ({ name, key: normPlace(name), c }));
  const whole = normPlace(text);
  const exact = entries.find((e) => e.key === whole);
  if (exact) return { name: exact.name, ...exact.c };
  const contained = entries
    .filter((e) => e.key && ` ${whole} `.includes(` ${e.key} `))
    .sort((a, b) => b.key.length - a.key.length);
  const last = normPlace(text.split(",").pop() ?? "");
  const tail = entries.find((e) => e.key === last);
  // « Route de Khombole, km 3, Thiès » : la ville en fin d'adresse fait foi…
  // sauf si c'est Dakar et qu'un quartier plus précis est cité (« Keur
  // Massar, Dakar »).
  if (tail && !(WIDE.has(tail.key) && (!wide || contained.some((e) => e.key !== tail.key)))) {
    return { name: tail.name, ...tail.c };
  }
  const best = contained.find((e) => !WIDE.has(e.key)) ?? (wide ? contained[0] : undefined);
  return best ? { name: best.name, ...best.c } : null;
}

/** Noms trop larges pour situer précisément un lieu s'il y a mieux. */
const WIDE = new Set(["dakar"]);
