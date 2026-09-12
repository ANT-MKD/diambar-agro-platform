export interface PromoCode {
  code: string;
  label: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal?: number;
}

export const PROMO_CODES: PromoCode[] = [
  {
    code: "BIENVENUE10",
    label: "10 % sur la première commande",
    type: "percent",
    value: 10,
    minSubtotal: 5_000,
  },
  {
    code: "FRAISGRATUIT",
    label: "Livraison offerte",
    type: "fixed",
    value: 2_500,
    minSubtotal: 25_000,
  },
  { code: "BAOBAB5", label: "5 % fidélité", type: "percent", value: 5, minSubtotal: 15_000 },
];

export function findPromoCode(raw: string): PromoCode | undefined {
  const code = raw.trim().toUpperCase();
  return PROMO_CODES.find((p) => p.code === code);
}

export function computePromoDiscount(
  promo: PromoCode,
  subtotal: number,
  deliveryFee: number,
): number {
  if (promo.minSubtotal && subtotal < promo.minSubtotal) return 0;
  if (promo.type === "percent") {
    return Math.round(subtotal * (promo.value / 100));
  }
  if (promo.code === "FRAISGRATUIT") {
    return deliveryFee;
  }
  return Math.min(promo.value, subtotal);
}
