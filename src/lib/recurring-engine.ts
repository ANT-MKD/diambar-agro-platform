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

// --- Commandes récurrentes en base : dates de livraison ---------------------------
// Avec la base, une récurrence décrit des jours de LIVRAISON ; chaque commande
// est passée automatiquement la veille, à l'heure choisie. Dakar = UTC : les
// dates « AAAA-MM-JJ » sont lues en UTC.

const DAY = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysIso = (date: string, n: number) => isoDate(toMs(date) + n * DAY);

/** Jour ouvré : ni dimanche ni jour férié fixe. */
export function isBusinessDate(date: string): boolean {
  if (new Date(toMs(date)).getUTCDay() === 0) return false;
  return !SENEGAL_HOLIDAYS_2026.includes(date);
}

export type DeliverySchedule = {
  frequency: RecurringOrder["frequency"];
  intervalDays?: number | null;
  /** Jours de livraison (0 = dimanche). */
  daysOfWeek: number[];
  /** Première livraison (AAAA-MM-JJ). */
  firstDeliveryOn: string;
};

/** Première date de livraison prévue à partir de `from` (incluse). */
export function nextDeliveryDate(s: DeliverySchedule, from: string): string | null {
  const start = from < s.firstDeliveryOn ? s.firstDeliveryOn : from;
  if (s.frequency === "monthly") {
    const day = new Date(toMs(s.firstDeliveryOn)).getUTCDate();
    const d = new Date(toMs(start));
    for (let i = 0; i < 24; i++) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + i;
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const candidate = isoDate(Date.UTC(y, m, Math.min(day, last)));
      if (candidate >= start) return candidate;
    }
    return null;
  }
  if (s.frequency === "every_n_days") {
    const n = Math.max(1, s.intervalDays ?? 1);
    const k = Math.max(0, Math.ceil((toMs(start) - toMs(s.firstDeliveryOn)) / (n * DAY)));
    return addDaysIso(s.firstDeliveryOn, k * n);
  }
  const days = s.daysOfWeek.length ? s.daysOfWeek : [new Date(toMs(s.firstDeliveryOn)).getUTCDay()];
  for (let i = 0; i < 400; i++) {
    const candidate = addDaysIso(start, i);
    if (!days.includes(new Date(toMs(candidate)).getUTCDay())) continue;
    if (s.frequency === "biweekly") {
      const weeks = Math.floor((toMs(candidate) - toMs(s.firstDeliveryOn)) / (7 * DAY));
      if (weeks % 2 !== 0) continue;
    }
    return candidate;
  }
  return null;
}

/** Livraison un jour non ouvré : la veille ou le lendemain ouvré, selon la
 * règle (« ask_confirmation » : la date reste, le restaurant tranchera). */
export function shiftForHoliday(
  date: string,
  rule: "day_before" | "day_after" | "ask_confirmation",
): string {
  if (rule === "ask_confirmation" || isBusinessDate(date)) return date;
  let d = date;
  for (let i = 0; i < 7 && !isBusinessDate(d); i++)
    d = addDaysIso(d, rule === "day_before" ? -1 : 1);
  return d;
}

/** Moment où la commande est passée : la veille de la livraison, à l'heure dite. */
export function orderRunAt(deliveryOn: string, orderTime: string): Date {
  const [h, m] = orderTime.split(":").map(Number);
  return new Date(toMs(deliveryOn) - DAY + ((h || 0) * 60 + (m || 0)) * 60_000);
}

// --- Règles d'une échéance (prix, stock, budget, jour non ouvré) ---------------------

export type OccurrenceProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  /** Commandable (actif, producteur actif, disponible à cette date). */
  orderable: boolean;
  category: string;
};

export type PlanEvent = { kind: string; message: string };

export type OccurrencePlan =
  | { kind: "skip"; events: PlanEvent[] }
  | { kind: "pending"; pending: NonNullable<RecurringOrder["pendingAction"]>; events: PlanEvent[] }
  | { kind: "pause"; reason: string; events: PlanEvent[] }
  | { kind: "order"; items: RecurringOrderItem[]; events: PlanEvent[] };

/** Décide ce que devient l'échéance du `occurrenceDate`, sur les vrais prix
 * et stocks du moment. `bypass` : règle déjà confirmée par le restaurant. */
export function planOccurrence(input: {
  items: RecurringOrderItem[];
  rules: RecurringOrder["rules"];
  occurrenceDate: string;
  products: OccurrenceProduct[];
  /** Frais de livraison estimés (pour la règle de budget). */
  deliveryFee: number;
  bypass?: NonNullable<RecurringOrder["pendingAction"]>["kind"];
}): OccurrencePlan {
  const { rules, occurrenceDate: day, bypass } = input;
  const events: PlanEvent[] = [];
  const product = (id: string) => input.products.find((p) => p.id === id);
  const fr = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} F CFA`;
  const pending = (kind: NonNullable<RecurringOrder["pendingAction"]>["kind"], detail: string) => ({
    kind: "pending" as const,
    pending: { kind, detail, occurrenceDate: day },
    events: [...events, { kind: "rule_triggered", message: `${detail} Confirmation demandée.` }],
  });

  if (
    rules.onNonBusinessDay === "ask_confirmation" &&
    !isBusinessDate(day) &&
    bypass !== "non_business_day"
  ) {
    return pending("non_business_day", `La livraison du ${day} tombe un jour non ouvré.`);
  }

  // Stock (et produits retirés ou hors saison).
  const available = (it: RecurringOrderItem) => {
    const p = product(it.productId);
    return !!p && p.orderable && p.stock >= it.qty;
  };
  let items = input.items;
  const missing = items.filter((it) => !available(it));
  if (missing.length > 0) {
    const names = missing.map((it) => product(it.productId)?.name ?? "produit retiré").join(", ");
    if (rules.onOutOfStock === "ask_confirmation" && bypass !== "out_of_stock") {
      return pending("out_of_stock", `Stock insuffisant pour : ${names}.`);
    }
    if (rules.onOutOfStock === "cancel_all") {
      return {
        kind: "skip",
        events: [
          { kind: "rule_triggered", message: `Rupture (${names}) : livraison du ${day} annulée.` },
        ],
      };
    }
    if (rules.onOutOfStock === "replace_equivalent") {
      const unresolved: string[] = [];
      items = items.map((it) => {
        if (available(it)) return it;
        const original = product(it.productId);
        const twin = input.products.find(
          (p) =>
            p.id !== it.productId &&
            p.orderable &&
            p.stock >= it.qty &&
            p.category === original?.category &&
            !input.items.some((o) => o.productId === p.id),
        );
        if (!twin) {
          unresolved.push(original?.name ?? "produit retiré");
          return it;
        }
        events.push({
          kind: "rule_triggered",
          message: `${original?.name ?? "Produit"} remplacé par ${twin.name}.`,
        });
        return { productId: twin.id, qty: it.qty, referencePrice: twin.price };
      });
      if (unresolved.length > 0) {
        if (bypass === "out_of_stock") {
          items = items.filter(available);
        } else {
          return pending(
            "out_of_stock",
            `Aucun produit équivalent pour : ${unresolved.join(", ")}.`,
          );
        }
      }
    } else {
      // cancel_item, ou rupture confirmée par le restaurant : on retire les lignes.
      items = items.filter(available);
      events.push({
        kind: "rule_triggered",
        message: `Retiré de la commande (rupture) : ${names}.`,
      });
    }
  }
  if (items.length === 0) {
    return {
      kind: "skip",
      events: [
        ...events,
        {
          kind: "rule_triggered",
          message: `Aucun produit disponible : livraison du ${day} annulée.`,
        },
      ],
    };
  }

  // Prix.
  const hike = items.find((it) => {
    const p = product(it.productId)!;
    return (
      it.referencePrice > 0 &&
      p.price > it.referencePrice * (1 + rules.priceIncreaseThresholdPct / 100)
    );
  });
  if (hike) {
    const p = product(hike.productId)!;
    const pct = Math.round(((p.price - hike.referencePrice) / hike.referencePrice) * 100);
    const detail = `Prix de ${p.name} en hausse de ${pct} % (${fr(hike.referencePrice)} → ${fr(p.price)}).`;
    if (rules.onPriceIncrease === "suspend") {
      return {
        kind: "pause",
        reason: `Prix de ${p.name} en hausse de ${pct} %`,
        events: [...events, { kind: "rule_triggered", message: `${detail} Récurrence suspendue.` }],
      };
    }
    if (rules.onPriceIncrease === "ask_confirmation" && bypass !== "price_increase") {
      return pending("price_increase", detail);
    }
    events.push({ kind: "rule_triggered", message: `${detail} Commande maintenue.` });
  }

  // Budget.
  const subtotal = (list: RecurringOrderItem[]) =>
    list.reduce((s, it) => s + Math.round(it.qty * (product(it.productId)?.price ?? 0)), 0);
  const total = subtotal(items) + input.deliveryFee;
  if (rules.maxBudget > 0 && total > rules.maxBudget) {
    const detail = `Total estimé ${fr(total)}, au-dessus du budget de ${fr(rules.maxBudget)}.`;
    if (rules.onBudgetExceeded === "cancel") {
      return {
        kind: "skip",
        events: [
          ...events,
          { kind: "rule_triggered", message: `${detail} Livraison du ${day} annulée.` },
        ],
      };
    }
    if (rules.onBudgetExceeded === "ask_confirmation" && bypass !== "budget_exceeded") {
      return pending("budget_exceeded", detail);
    }
    if (rules.onBudgetExceeded === "reduce_quantities" && bypass !== "budget_exceeded") {
      const ratio = Math.max(
        0,
        (rules.maxBudget - input.deliveryFee) / Math.max(1, subtotal(items)),
      );
      items = items
        .map((it) => ({ ...it, qty: Math.floor(it.qty * ratio * 1000) / 1000 }))
        .filter((it) => it.qty > 0);
      events.push({
        kind: "rule_triggered",
        message: `${detail} Quantités réduites pour respecter le budget.`,
      });
      if (items.length === 0) return { kind: "skip", events };
    } else {
      events.push({ kind: "rule_triggered", message: `${detail} Commande maintenue.` });
    }
  }
  return { kind: "order", items, events };
}
