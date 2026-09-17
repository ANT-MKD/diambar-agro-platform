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
