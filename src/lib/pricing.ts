// Règles de prix d'une commande restaurant, partagées par le panier, le
// paiement, les commandes récurrentes et les factures.
//
// Qui paie quoi :
//   - le restaurant paie : marchandise + frais de livraison − promo − avoir ;
//   - le producteur est payé sur la marchandise seule (moins sa commission) :
//     les promos et avoirs sont des gestes de la plateforme, jamais retirés
//     de ses revenus ;
//   - les frais de livraison reviennent à la plateforme, qui rémunère le
//     livreur.

export type ZoneLike = { id: string; name: string; baseFee: number; active: boolean };

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Zone de livraison d'une adresse : la zone nommée dans l'adresse saisie
 * (« Le Baobab, Dakar Plateau »), sinon la ville déclarée du restaurant. */
export function zoneForAddress<Z extends ZoneLike>(
  zones: Z[],
  city: string | undefined,
  address: string | undefined,
): Z | null {
  if (address) {
    const a = norm(address);
    // La zone au nom le plus long d'abord (« Dakar Plateau » avant « Dakar »).
    const sorted = [...zones].sort((x, y) => y.name.length - x.name.length);
    const byAddress = sorted.find((z) => a.includes(norm(z.name)));
    if (byAddress) return byAddress;
  }
  if (city) {
    const byCity = zones.find((z) => norm(z.name) === norm(city));
    if (byCity) return byCity;
  }
  return null;
}

/** Frais de livraison d'une livraison (une par producteur) dans une zone. */
export function deliveryFeeForZone(zone: ZoneLike): number {
  return zone.baseFee;
}

/** Répartit un montant entre plusieurs parts au prorata de leur poids, sans
 * perdre ni créer un franc (le reste d'arrondi va à la dernière part). */
export function allocate(amount: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((s, w) => s + w, 0);
  if (amount <= 0 || total <= 0) return weights.map(() => 0);
  const parts = weights.map((w) => Math.floor((amount * w) / total));
  const rest = amount - parts.reduce((s, p) => s + p, 0);
  parts[parts.length - 1] += rest;
  return parts;
}

export type OrderAmounts = {
  subtotal: number;
  deliveryFee: number;
  promoDiscount: number;
  creditApplied: number;
  total: number;
};

/** Montants d'une commande restaurant ; les commandes de démo plus anciennes
 * n'ont que `items` et `total`. */
export function orderAmounts(o: {
  items: { qty: number; price: number }[];
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  promoDiscount?: number;
  creditApplied?: number;
}): OrderAmounts {
  const subtotal = o.subtotal ?? o.items.reduce((s, i) => s + i.qty * i.price, 0);
  return {
    subtotal,
    deliveryFee: o.deliveryFee ?? 0,
    promoDiscount: o.promoDiscount ?? 0,
    creditApplied: o.creditApplied ?? 0,
    total: o.total,
  };
}
