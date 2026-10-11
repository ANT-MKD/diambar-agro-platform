import type { ReceptionDay, ReceptionSlot } from "@/data/mocks";

// Correspond à Date.getDay() : 0 = dimanche ... 6 = samedi.
const DAY_BY_INDEX: ReceptionDay[] = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

/**
 * Calcule les prochains créneaux de livraison réellement proposables au
 * checkout, à partir des créneaux de réception configurés dans les
 * paramètres Établissement (un seul créneau par jour). On avance jour par
 * jour tant qu'on n'a pas trouvé assez de jours ouverts, sans jamais
 * inventer un horaire non configuré.
 */
export function nextReceptionSlots(
  receptionHours: Record<ReceptionDay, ReceptionSlot>,
  opts: { from?: Date; count?: number; daysAhead?: number } = {},
): string[] {
  const from = opts.from ?? new Date();
  const count = opts.count ?? 4;
  const daysAhead = opts.daysAhead ?? 14;
  const slots: string[] = [];

  for (let d = 0; d < daysAhead && slots.length < count; d++) {
    const date = new Date(from);
    date.setDate(date.getDate() + d);
    const day = DAY_BY_INDEX[date.getDay()];
    const slot = receptionHours[day];
    if (!slot?.open) continue;
    const label = d === 0 ? "Aujourd'hui" : d === 1 ? "Demain" : day;
    slots.push(`${label} · ${slot.from} – ${slot.to}`);
  }

  return slots;
}

// Heure limite de commande : avant 18 h, livraison possible dès le
// lendemain ; après, à partir du surlendemain. Jamais le jour même, le
// producteur doit récolter et préparer.
export const ORDER_CUTOFF_HOUR = 18;

export type DeliverySlot = {
  /** Libellé daté, stable dans le temps (« Mardi 30 sept. · 07:00 – 11:00 »). */
  label: string;
  /** Début du créneau (ISO), utilisé pour planifier la mission. */
  start: string;
  /** Livraison dès le lendemain : la mission est prioritaire. */
  nextDay: boolean;
};

export function deliverySlots(
  receptionHours: Record<ReceptionDay, ReceptionSlot>,
  opts: { now?: Date; count?: number; daysAhead?: number } = {},
): DeliverySlot[] {
  const now = opts.now ?? new Date();
  const count = opts.count ?? 4;
  const daysAhead = opts.daysAhead ?? 14;
  const firstDay = now.getHours() < ORDER_CUTOFF_HOUR ? 1 : 2;
  const slots: DeliverySlot[] = [];
  for (let d = firstDay; d < daysAhead && slots.length < count; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const day = DAY_BY_INDEX[date.getDay()];
    const slot = receptionHours[day];
    if (!slot?.open) continue;
    const [h, m] = slot.from.split(":").map(Number);
    const start = new Date(date);
    start.setHours(h || 0, m || 0, 0, 0);
    const dateLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    slots.push({
      label: `${day} ${dateLabel} · ${slot.from} – ${slot.to}`,
      start: start.toISOString(),
      nextDay: d === 1,
    });
  }
  return slots;
}

/** Message expliquant l'heure limite, affiché au moment de commander. */
export function cutoffHint(now = new Date()): string {
  return now.getHours() < ORDER_CUTOFF_HOUR
    ? `Commandez avant ${ORDER_CUTOFF_HOUR} h pour être livré demain.`
    : `Passé ${ORDER_CUTOFF_HOUR} h : première livraison possible après-demain.`;
}
