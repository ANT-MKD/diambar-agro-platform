import { DEFAULT_RULES } from "@/lib/platform-rules";

// Informations affichées sur le site public, tirées des réglages de la
// plateforme (Paramètres → Entreprise, commissions, paie des livreurs) : le
// site ne montre jamais de coordonnées ni de tarifs inventés.

export type PublicTier = { rate: number; min: number; max: number | null };

export type PublicInfo = {
  /** Coordonnées saisies dans l'assistant (chaîne vide : non renseignée). */
  company: { name: string; email: string; phone: string; whatsapp: string; address: string };
  /** Paliers de commission producteur, du plus petit volume au plus grand. */
  tiers: PublicTier[];
  /** Part de la course gardée par le livreur (%). */
  driverShare: number;
  /** Frais de livraison de la première tranche de distance (F CFA). */
  deliveryFrom: number;
  cutoffHour: number;
  receptionWindowHours: number;
};

export const DEFAULT_PUBLIC_INFO: PublicInfo = {
  company: { name: "Diambar Agro", email: "", phone: "", whatsapp: "", address: "" },
  tiers: [{ rate: 15, min: 0, max: null }],
  driverShare: 100 - DEFAULT_RULES.driverPay.commissionRate,
  deliveryFrom: 0,
  cutoffHour: DEFAULT_RULES.cutoffHour,
  receptionWindowHours: DEFAULT_RULES.receptionWindowHours,
};

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} F CFA`;
const pct = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} %`;

/** « 5 – 15 % », ou « 15 % » avec un seul taux. */
export function commissionRange(tiers: PublicTier[]): string {
  const rates = tiers.map((t) => t.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? pct(max) : `${new Intl.NumberFormat("fr-FR").format(min)} – ${pct(max)}`;
}

/** Explication de la commission, palier par palier. */
export function commissionExplanation(tiers: PublicTier[]): string {
  if (tiers.length <= 1) {
    return `Un taux unique de ${pct(tiers[0]?.rate ?? 0)}, prélevé uniquement sur les commandes livrées.`;
  }
  const parts = tiers.map((t) =>
    t.max == null
      ? `${pct(t.rate)} au-delà de ${fcfa(t.min)}`
      : `${pct(t.rate)} jusqu'à ${fcfa(t.max)}`,
  );
  return `Elle dépend de votre volume de ventes du mois : ${parts.join(", ")}.`;
}

/** Lien WhatsApp (wa.me) d'un numéro sénégalais, ou null. */
export function whatsappLink(phone: string, text?: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const full = digits.length === 9 ? `221${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Lien tel: d'un numéro, ou null. */
export function telLink(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 9 ? `tel:${digits}` : null;
}
