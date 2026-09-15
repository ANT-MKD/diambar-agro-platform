import type { RecurringOrder, RecurringOrderItem } from "@/data/mocks";

// Jours fériés réels du Sénégal pour 2026 (dates officielles fixes ; les
// fêtes mobiles — Korité, Tabaski, Maouloud — varient chaque année et ne
// sont pas incluses ici pour éviter d'afficher une date fausse).
export const SENEGAL_HOLIDAYS_2026 = [
  "2026-01-01", // Jour de l'An
  "2026-04-04", // Fête de l'Indépendance
  "2026-05-01", // Fête du Travail
  "2026-08-15", // Assomption
  "2026-11-01", // Toussaint
  "2026-12-25", // Noël
];

export function isBusinessDay(date: Date): boolean {
  if (date.getDay() === 0) return false; // dimanche
  const iso = date.toISOString().slice(0, 10);
  return !SENEGAL_HOLIDAYS_2026.includes(iso);
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Calcule la prochaine occurrence strictement après `after`, en fonction
 * de la fréquence configurée. Ne tient pas compte des jours fériés — voir
 * `applyHolidayShift` pour ça, appliqué séparément par l'appelant. */
export function computeNextOccurrence(ro: RecurringOrder, after: Date): Date | null {
  const [h, m] = ro.createTime.split(":").map(Number);

  if (ro.frequency === "monthly") {
    const day = new Date(ro.firstRunAt).getDate();
    let candidate = new Date(after.getFullYear(), after.getMonth(), day, h, m, 0, 0);
    if (candidate <= after) {
      candidate = new Date(after.getFullYear(), after.getMonth() + 1, day, h, m, 0, 0);
    }
    return candidate;
  }

  if (ro.frequency === "every_n_days") {
    const interval = Math.max(1, ro.intervalDays ?? 1);
    let candidate = new Date(ro.firstRunAt);
    candidate.setHours(h, m, 0, 0);
    let guard = 0;
    while (candidate <= after && guard < 2000) {
      candidate = addDays(candidate, interval);
      guard++;
    }
    return candidate;
  }

  // weekly / biweekly / custom : basé sur daysOfWeek
  const days = ro.daysOfWeek.length ? ro.daysOfWeek : [1];
  const biweekly = ro.frequency === "biweekly";
  const firstRun = new Date(ro.firstRunAt);
  let candidate = new Date(after);
  candidate.setHours(h, m, 0, 0);
  if (candidate <= after) candidate = addDays(candidate, 1);

  for (let i = 0; i < 120; i++) {
    if (days.includes(candidate.getDay())) {
      if (biweekly) {
        const weeksSinceFirst = Math.floor(
          (candidate.getTime() - firstRun.getTime()) / (7 * 86400_000),
        );
        if (((weeksSinceFirst % 2) + 2) % 2 !== 0) {
          candidate = addDays(candidate, 1);
          continue;
        }
      }
      return candidate;
    }
    candidate = addDays(candidate, 1);
  }
  return null;
}

/** Applique la règle "jour non ouvré" : décale la date si demandé, ou
 * signale qu'une confirmation est requise avant de générer la commande. */
export function applyHolidayShift(
  date: Date,
  rule: "day_before" | "day_after" | "ask_confirmation",
): { date: Date; needsConfirmation: boolean } {
  if (isBusinessDay(date)) return { date, needsConfirmation: false };
  if (rule === "ask_confirmation") return { date, needsConfirmation: true };
  const shifted = rule === "day_before" ? addDays(date, -1) : addDays(date, 1);
  return { date: shifted, needsConfirmation: false };
}

export function itemsSubtotal(
  items: RecurringOrderItem[],
  priceOf: (productId: string) => number,
): number {
  return items.reduce((s, i) => s + i.qty * priceOf(i.productId), 0);
}

export function frequencyLabel(
  ro: Pick<RecurringOrder, "frequency" | "intervalDays" | "daysOfWeek">,
): string {
  const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const dayList = ro.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ");
  switch (ro.frequency) {
    case "weekly":
      return `Chaque semaine · ${dayList}`;
    case "biweekly":
      return `Toutes les 2 semaines · ${dayList}`;
    case "monthly":
      return "Chaque mois";
    case "every_n_days":
      return `Tous les ${ro.intervalDays ?? 1} jours`;
    case "custom":
      return `Personnalisée · ${dayList}`;
    default:
      return "";
  }
}
