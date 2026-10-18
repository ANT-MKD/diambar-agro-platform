import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  categories,
  farmers,
  products,
  recurringOrderEvents,
  recurringOrders,
  restaurants,
  users,
} from "@/db/schema";
import type {
  PaymentMethod,
  RecurringOrder,
  RecurringOrderException,
  RecurringOrderItem,
} from "@/data/mocks";
import { deliveryChoice, deliveryTimeProblem, firstDeliveryDay } from "@/lib/delivery-time";
import { formatFCFA } from "@/lib/format";
import { minutesOf } from "@/lib/platform-rules";
import {
  addDaysIso,
  isoDate,
  nextDeliveryDate,
  orderRunAt,
  planOccurrence,
  shiftForHoliday,
  type OccurrenceProduct,
  type PlanEvent,
} from "@/lib/recurring-engine";
import { fail, MarketError, notifyUser, type Q } from "./market-common.server";
import { placeOrder, quoteCheckoutDelivery } from "./market-db.server";
import { PAYMENT_METHOD_DB, PAYMENT_METHOD_LABEL, readRules } from "./snapshot.server";

// Commandes récurrentes en base. Une récurrence décrit des jours de
// livraison ; la commande de chaque livraison est passée automatiquement la
// veille, à l'heure choisie par le restaurant, par le passage régulier du
// serveur (voir runDueRecurringOrders). Les règles du restaurant (prix,
// stock, budget, jour non ouvré) sont évaluées sur les vrais prix et stocks
// du moment ; si l'une demande son avis, la récurrence attend sa décision.

type Row = typeof recurringOrders.$inferSelect;
type Pending = NonNullable<RecurringOrder["pendingAction"]>;

export type RecurringInput = {
  name: string;
  farmerId: string;
  items: { productId: string; qty: number }[];
  frequency: RecurringOrder["frequency"];
  intervalDays?: number;
  daysOfWeek: number[];
  deliveryTime: string;
  orderTime: string;
  firstDeliveryOn: string;
  end: RecurringOrder["end"];
  rules: RecurringOrder["rules"];
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  shortagePreference: "partial" | "cancel";
  instructions?: string;
};

const todayIso = (now: Date) => isoDate(now.getTime());

async function event(q: Q, recurringOrderId: string, e: PlanEvent, orderId?: string) {
  await q.insert(recurringOrderEvents).values({
    recurringOrderId,
    kind: e.kind,
    message: e.message,
    orderId: orderId ?? null,
  });
}

async function ownRecurring(q: Q, restaurantId: string, id: string): Promise<Row> {
  const [row] = await q.select().from(recurringOrders).where(eq(recurringOrders.id, id));
  if (!row || row.restaurantId !== restaurantId) fail("Commande récurrente introuvable.");
  return row;
}

/** Prochaine livraison à partir de `from` (incluse) dont la commande peut
 * encore être passée à temps, et le moment où elle le sera. null : terminée. */
async function scheduleFrom(
  q: Q,
  row: Pick<
    Row,
    | "frequency"
    | "intervalDays"
    | "daysOfWeek"
    | "firstDeliveryOn"
    | "endRule"
    | "rules"
    | "orderTime"
    | "deliveryTime"
    | "generatedCount"
  >,
  from: string,
  now: Date,
): Promise<{ deliveryOn: string; runAt: Date } | null> {
  const end = row.endRule as RecurringOrder["end"];
  if (end.type === "after_count" && row.generatedCount >= end.count) return null;
  const rules = await readRules(q as Db);
  const holidayRule = (row.rules as RecurringOrder["rules"]).onNonBusinessDay;
  const schedule = {
    frequency: row.frequency as RecurringOrder["frequency"],
    intervalDays: row.intervalDays,
    daysOfWeek: row.daysOfWeek as number[],
    firstDeliveryOn: row.firstDeliveryOn,
  };
  let cursor = from;
  for (let i = 0; i < 120; i++) {
    const planned = nextDeliveryDate(schedule, cursor);
    if (!planned) return null;
    if (end.type === "on_date" && planned > end.date.slice(0, 10)) return null;
    const deliveryOn = shiftForHoliday(planned, holidayRule);
    const runAt = orderRunAt(deliveryOn, row.orderTime);
    // Encore faisable : moment de commande à venir, ou passé de peu tant
    // que la livraison reste possible (heure limite pas encore dépassée).
    const slot = new Date(deliveryChoice(deliveryOn, row.deliveryTime).start);
    if (runAt > now || !deliveryTimeProblem(slot, now, rules)) {
      return { deliveryOn, runAt: runAt > now ? runAt : now };
    }
    cursor = addDaysIso(planned, 1);
  }
  return null;
}

async function reschedule(q: Q, row: Row, from: string, now: Date, extra: Partial<Row> = {}) {
  const next = await scheduleFrom(q, { ...row, ...extra }, from, now);
  await q
    .update(recurringOrders)
    .set({
      ...extra,
      status: next ? (extra.status ?? "active") : "ended",
      nextDeliveryOn: next?.deliveryOn ?? null,
      nextRunAt: next?.runAt ?? null,
      pendingAction: null,
      updatedAt: new Date(),
    })
    .where(eq(recurringOrders.id, row.id));
  if (!next) {
    await event(q, row.id, {
      kind: "ended",
      message: "Récurrence terminée : plus de livraison prévue.",
    });
  }
  return next;
}

async function validateInput(q: Q, restaurantId: string, input: RecurringInput) {
  const rules = await readRules(q as Db);
  if (!input.items.length) fail("Ajoutez au moins un produit.");
  const [resto] = await q.select().from(restaurants).where(eq(restaurants.userId, restaurantId));
  if (!resto) fail("Votre établissement n'est pas encore enregistré : contactez le support.");
  const [farmer] = await q
    .select({ status: users.status })
    .from(users)
    .innerJoin(farmers, eq(farmers.userId, users.id))
    .where(eq(users.id, input.farmerId));
  if (farmer?.status !== "active")
    fail("Ce producteur ne vend pas sur Diambar Agro pour le moment.");
  const rows = await q
    .select({
      id: products.id,
      farmerId: products.farmerId,
      price: products.price,
      status: products.status,
      name: products.name,
    })
    .from(products)
    .where(inArray(products.id, [...new Set(input.items.map((i) => i.productId))]));
  for (const it of input.items) {
    const p = rows.find((r) => r.id === it.productId);
    if (!p || p.farmerId !== input.farmerId)
      fail("Un produit choisi n'est pas proposé par ce producteur.");
    if (p.status === "draft") fail(`${p.name} a été retiré du catalogue.`);
    if (!(it.qty > 0)) fail(`Quantité invalide pour ${p.name}.`);
  }
  const { from, to } = rules.deliveryHours;
  if (
    minutesOf(input.deliveryTime) < minutesOf(from) ||
    minutesOf(input.deliveryTime) > minutesOf(to)
  ) {
    fail(`Les livraisons se font entre ${from} et ${to}.`);
  }
  if (minutesOf(input.orderTime) >= rules.cutoffHour * 60) {
    fail(
      `La commande est passée la veille avant ${rules.cutoffHour} h (heure limite) : choisissez une heure plus tôt.`,
    );
  }
  if (!rules.paymentMethods.includes(input.paymentMethod)) {
    fail(`Le paiement par ${input.paymentMethod} n'est pas proposé pour le moment.`);
  }
  if (input.frequency === "every_n_days" && !(input.intervalDays && input.intervalDays >= 1)) {
    fail("Indiquez tous les combien de jours livrer.");
  }
  if (["weekly", "biweekly", "custom"].includes(input.frequency) && !input.daysOfWeek.length) {
    fail("Choisissez au moins un jour de livraison.");
  }
  return rows;
}

export async function createRecurringOrder(
  db: Db,
  restaurantId: string,
  input: RecurringInput,
  now = new Date(),
): Promise<string> {
  return db.transaction(async (tx) => {
    const rows = await validateInput(tx, restaurantId, input);
    const rules = await readRules(tx as unknown as Db);
    const earliest = isoDate(firstDeliveryDay(now, rules.cutoffHour));
    const first = input.firstDeliveryOn < earliest ? earliest : input.firstDeliveryOn;
    const items: RecurringOrderItem[] = input.items.map((it) => ({
      productId: it.productId,
      qty: it.qty,
      referencePrice: rows.find((r) => r.id === it.productId)!.price,
    }));
    const base = {
      restaurantId,
      farmerId: input.farmerId,
      name: input.name.trim() || "Commande récurrente",
      items,
      frequency: input.frequency,
      intervalDays: input.frequency === "every_n_days" ? (input.intervalDays ?? 1) : null,
      daysOfWeek:
        input.frequency === "monthly" || input.frequency === "every_n_days" ? [] : input.daysOfWeek,
      deliveryTime: input.deliveryTime,
      orderTime: input.orderTime,
      firstDeliveryOn: first,
      endRule: input.end,
      rules: input.rules,
      deliveryAddress: input.deliveryAddress,
      paymentMethod: PAYMENT_METHOD_DB[input.paymentMethod],
      shortagePreference: input.shortagePreference,
      instructions: input.instructions?.trim() || null,
      generatedCount: 0,
    };
    const next = await scheduleFrom(tx, base, first, now);
    if (!next) fail("Aucune livraison possible avec ce calendrier : vérifiez les dates.");
    const [row] = await tx
      .insert(recurringOrders)
      .values({ ...base, nextDeliveryOn: next.deliveryOn, nextRunAt: next.runAt })
      .returning({ id: recurringOrders.id });
    await event(tx, row.id, {
      kind: "created",
      message: `Commande récurrente créée : première livraison le ${next.deliveryOn}.`,
    });
    return row.id;
  });
}

export type RecurringPatch = Partial<
  Pick<RecurringInput, "name" | "rules" | "deliveryAddress" | "paymentMethod" | "instructions">
> & { items?: { productId: string; qty: number; referencePrice?: number }[] };

export async function updateRecurringOrder(
  db: Db,
  restaurantId: string,
  id: string,
  patch: RecurringPatch,
) {
  await db.transaction(async (tx) => {
    const row = await ownRecurring(tx, restaurantId, id);
    const set: Partial<Row> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name.trim() || row.name;
    if (patch.rules) set.rules = patch.rules;
    if (patch.deliveryAddress) set.deliveryAddress = patch.deliveryAddress;
    if (patch.instructions !== undefined) set.instructions = patch.instructions.trim() || null;
    if (patch.paymentMethod) {
      const rules = await readRules(tx as unknown as Db);
      if (!rules.paymentMethods.includes(patch.paymentMethod)) {
        fail(`Le paiement par ${patch.paymentMethod} n'est pas proposé pour le moment.`);
      }
      set.paymentMethod = PAYMENT_METHOD_DB[patch.paymentMethod];
    }
    if (patch.items) {
      if (!patch.items.length) fail("Gardez au moins un produit.");
      const rows = await tx
        .select({ id: products.id, farmerId: products.farmerId, price: products.price })
        .from(products)
        .where(
          inArray(
            products.id,
            patch.items.map((i) => i.productId),
          ),
        );
      const previous = row.items as RecurringOrderItem[];
      set.items = patch.items.map((it) => {
        const p = rows.find((r) => r.id === it.productId);
        if (!p || p.farmerId !== row.farmerId)
          fail("Un produit choisi n'est pas proposé par ce producteur.");
        if (!(it.qty > 0)) fail("Quantité invalide.");
        // Prix de référence : celui d'origine pour un produit déjà présent.
        const old = previous.find((o) => o.productId === it.productId);
        return {
          productId: it.productId,
          qty: it.qty,
          referencePrice: old?.referencePrice ?? p.price,
        };
      });
    }
    await tx.update(recurringOrders).set(set).where(eq(recurringOrders.id, id));
    await event(tx, id, { kind: "edited", message: "Commande récurrente modifiée." });
  });
}

export async function pauseRecurringOrder(
  db: Db,
  restaurantId: string,
  id: string,
  reason: string,
  pausedUntil?: string,
) {
  await db.transaction(async (tx) => {
    const row = await ownRecurring(tx, restaurantId, id);
    if (row.status === "ended") fail("Cette récurrence est terminée.");
    await tx
      .update(recurringOrders)
      .set({
        status: "paused",
        pauseReason: reason.trim() || "Pause",
        pausedUntil: pausedUntil ? new Date(pausedUntil) : null,
        nextRunAt: null,
        pendingAction: null,
        updatedAt: new Date(),
      })
      .where(eq(recurringOrders.id, id));
    await event(tx, id, {
      kind: "paused",
      message: `Mise en pause${reason.trim() ? ` : ${reason.trim()}` : ""}${pausedUntil ? ` (jusqu'au ${pausedUntil.slice(0, 10)})` : ""}.`,
    });
  });
}

export async function resumeRecurringOrder(
  db: Db,
  restaurantId: string,
  id: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const row = await ownRecurring(tx, restaurantId, id);
    if (row.status === "ended") fail("Cette récurrence est terminée : créez-en une nouvelle.");
    const next = await reschedule(tx, row, todayIso(now), now, {
      status: "active",
      pauseReason: null,
      pausedUntil: null,
    });
    if (next) {
      await event(tx, id, {
        kind: "resumed",
        message: `Reprise : prochaine livraison le ${next.deliveryOn}.`,
      });
    }
  });
}

export async function cancelRecurringOrder(db: Db, restaurantId: string, id: string) {
  await db.transaction(async (tx) => {
    await ownRecurring(tx, restaurantId, id);
    await tx
      .update(recurringOrders)
      .set({
        status: "ended",
        nextRunAt: null,
        nextDeliveryOn: null,
        pendingAction: null,
        updatedAt: new Date(),
      })
      .where(eq(recurringOrders.id, id));
    await event(tx, id, {
      kind: "cancelled",
      message: "Récurrence arrêtée. Les commandes déjà passées restent en cours.",
    });
  });
}

/** Saute la prochaine livraison : la suivante devient la prochaine. */
export async function skipNextRecurringDelivery(
  db: Db,
  restaurantId: string,
  id: string,
  reason: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const row = await ownRecurring(tx, restaurantId, id);
    if (row.status !== "active" || !row.nextDeliveryOn) fail("Aucune livraison prévue à sauter.");
    await event(tx, id, {
      kind: "skipped",
      message: `Livraison du ${row.nextDeliveryOn} sautée${reason.trim() ? ` (${reason.trim()})` : ""}.`,
    });
    await reschedule(tx, row, addDaysIso(row.nextDeliveryOn, 1), now);
  });
}

/** Quantités différentes pour la prochaine livraison seulement. */
export async function overrideNextRecurringDelivery(
  db: Db,
  restaurantId: string,
  id: string,
  items: { productId: string; qty: number }[],
) {
  await db.transaction(async (tx) => {
    const row = await ownRecurring(tx, restaurantId, id);
    if (!row.nextDeliveryOn) fail("Aucune livraison prévue.");
    const base = row.items as RecurringOrderItem[];
    const clean = items.filter((i) => i.qty > 0);
    if (!clean.length) fail("Gardez au moins un produit, ou sautez cette livraison.");
    const ex: RecurringOrderException = {
      id: crypto.randomUUID(),
      type: "override",
      occurrenceDate: row.nextDeliveryOn,
      items: clean.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        referencePrice: base.find((b) => b.productId === i.productId)?.referencePrice ?? 0,
      })),
      createdAt: new Date().toISOString(),
    };
    const others = (row.exceptions as RecurringOrderException[]).filter(
      (e) => e.occurrenceDate !== row.nextDeliveryOn,
    );
    await tx
      .update(recurringOrders)
      .set({ exceptions: [...others, ex], updatedAt: new Date() })
      .where(eq(recurringOrders.id, id));
    await event(tx, id, {
      kind: "edited",
      message: `Quantités modifiées pour la livraison du ${row.nextDeliveryOn}.`,
    });
  });
}

// --- Passage des commandes -------------------------------------------------------------

async function occurrenceProducts(
  q: Q,
  farmerId: string,
  deliveryOn: string,
): Promise<OccurrenceProduct[]> {
  const rows = await q
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      stock: products.stockQty,
      status: products.status,
      availableFrom: products.availableFrom,
      category: categories.name,
      farmerStatus: users.status,
    })
    .from(products)
    .innerJoin(users, eq(users.id, products.farmerId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.farmerId, farmerId));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    stock: Number(r.stock),
    orderable:
      r.farmerStatus === "active" &&
      r.status === "active" &&
      (!r.availableFrom || r.availableFrom <= deliveryOn),
    category: r.category ?? "",
  }));
}

export type OccurrenceOutcome = "ordered" | "skipped" | "pending" | "paused" | "failed";

/** Traite l'échéance prévue d'une récurrence (déjà réservée par l'appelant). */
async function processOccurrence(
  db: Db,
  row: Row,
  now: Date,
  bypass?: Pending["kind"],
): Promise<OccurrenceOutcome> {
  const day = row.nextDeliveryOn;
  if (!day) return "skipped";
  const link = `/restaurant/recurring/${row.id}`;
  const rules = await readRules(db);
  const slot = deliveryChoice(day, row.deliveryTime);

  // Trop tard pour cette livraison (serveur arrêté, décision tardive…).
  if (deliveryTimeProblem(new Date(slot.start), now, rules)) {
    await event(db, row.id, {
      kind: "skipped",
      message: `Livraison du ${day} manquée : la commande n'a pas pu être passée à temps.`,
    });
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Livraison manquée · ${row.name}`,
      body: `La commande pour le ${day} n'a pas été passée à temps.`,
      link,
    });
    await reschedule(db, row, addDaysIso(day, 1), now);
    return "skipped";
  }

  const exceptions = row.exceptions as RecurringOrderException[];
  const override = exceptions.find((e) => e.type === "override" && e.occurrenceDate === day);
  const items = override?.items ?? (row.items as RecurringOrderItem[]);
  const productList = await occurrenceProducts(db, row.farmerId, day);
  const deliveryFee = await quoteCheckoutDelivery(db, row.restaurantId, {
    deliveryAddress: row.deliveryAddress,
    lines: items.map((i) => ({ productId: i.productId, qty: i.qty })),
  })
    .then((q) => q.total)
    .catch(() => 0);
  const plan = planOccurrence({
    items,
    rules: row.rules as RecurringOrder["rules"],
    occurrenceDate: day,
    products: productList,
    deliveryFee,
    bypass,
  });
  for (const e of plan.events) await event(db, row.id, e);

  if (plan.kind === "pending") {
    await db
      .update(recurringOrders)
      .set({
        status: "problem",
        pendingAction: plan.pending,
        nextRunAt: null,
        updatedAt: new Date(),
      })
      .where(eq(recurringOrders.id, row.id));
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Action requise · ${row.name}`,
      body: plan.pending.detail,
      link,
    });
    return "pending";
  }
  if (plan.kind === "pause") {
    await db
      .update(recurringOrders)
      .set({ status: "paused", pauseReason: plan.reason, nextRunAt: null, updatedAt: new Date() })
      .where(eq(recurringOrders.id, row.id));
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Récurrence en pause · ${row.name}`,
      body: plan.reason,
      link,
    });
    return "paused";
  }
  if (plan.kind === "skip") {
    await reschedule(db, row, addDaysIso(day, 1), now);
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Livraison annulée · ${row.name}`,
      body: plan.events.at(-1)?.message ?? `Pas de commande pour le ${day}.`,
      link,
    });
    return "skipped";
  }

  const method = PAYMENT_METHOD_LABEL[row.paymentMethod] ?? "Wave";
  try {
    const placed = await placeOrder(db, row.restaurantId, {
      lines: plan.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      deliveryAddress: row.deliveryAddress,
      slotStart: slot.start,
      slotLabel: slot.label,
      paymentMethod: method,
      shortagePreference: row.shortagePreference,
      instructions: row.instructions ?? undefined,
      recurringOrderId: row.id,
    });
    const ref = placed.orders.map((o) => o.reference).join(", ");
    await event(
      db,
      row.id,
      {
        kind: "generated",
        message: `Commande ${ref} passée pour le ${day} (${formatFCFA(placed.total)}).`,
      },
      placed.orders[0]?.id,
    );
    const generatedCount = row.generatedCount + 1;
    await reschedule(db, { ...row, generatedCount }, addDaysIso(day, 1), now, { generatedCount });
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Commande récurrente passée · ${row.name}`,
      body:
        method === "Espèces"
          ? `${ref} pour le ${slot.label} : ${formatFCFA(placed.total)}, payable à la livraison.`
          : `${ref} pour le ${slot.label} : ${formatFCFA(placed.total)} à payer par ${method}.`,
      link: placed.orders[0] ? `/restaurant/orders/${placed.orders[0].id}` : link,
    });
    return "ordered";
  } catch (err) {
    if (!(err instanceof MarketError)) throw err;
    await event(db, row.id, {
      kind: "failed",
      message: `Commande du ${day} non passée : ${err.message}`,
    });
    await notifyUser(db, row.restaurantId, {
      type: "order",
      title: `Commande récurrente non passée · ${row.name}`,
      body: err.message,
      link,
    });
    await reschedule(db, row, addDaysIso(day, 1), now);
    return "failed";
  }
}

/** Passage régulier : reprend les pauses arrivées à échéance, puis passe les
 * commandes dont le moment est venu. Chaque récurrence est réservée avant
 * d'être traitée : deux passages simultanés ne commandent jamais deux fois. */
export async function runDueRecurringOrders(db: Db, now = new Date()): Promise<number> {
  const resumable = await db
    .select()
    .from(recurringOrders)
    .where(
      and(
        eq(recurringOrders.status, "paused"),
        isNotNull(recurringOrders.pausedUntil),
        lte(recurringOrders.pausedUntil, now),
      ),
    );
  for (const row of resumable) {
    const next = await reschedule(db, row, todayIso(now), now, {
      status: "active",
      pauseReason: null,
      pausedUntil: null,
    });
    if (next) {
      await event(db, row.id, {
        kind: "resumed",
        message: `Fin de la pause : prochaine livraison le ${next.deliveryOn}.`,
      });
    }
  }

  const due = await db
    .select()
    .from(recurringOrders)
    .where(and(eq(recurringOrders.status, "active"), lte(recurringOrders.nextRunAt, now)))
    .orderBy(asc(recurringOrders.nextRunAt))
    .limit(25);
  let done = 0;
  for (const row of due) {
    // Réservation : seul le passage qui remet l'échéance à vide la traite
    // (comparaison faite par la base, sans dépendre de la précision des heures).
    const [claimed] = await db
      .update(recurringOrders)
      .set({ nextRunAt: null })
      .where(
        and(
          eq(recurringOrders.id, row.id),
          eq(recurringOrders.status, "active"),
          lte(recurringOrders.nextRunAt, now),
        ),
      )
      .returning({ id: recurringOrders.id });
    if (!claimed) continue;
    try {
      await processOccurrence(db, row, now);
      done++;
    } catch (err) {
      // Erreur inattendue : la récurrence est remise en file pour le prochain passage.
      console.error("[récurrentes]", row.id, err);
      await db
        .update(recurringOrders)
        .set({ nextRunAt: row.nextRunAt })
        .where(eq(recurringOrders.id, row.id));
    }
  }
  return done;
}

/** Décision du restaurant sur une règle déclenchée : commander quand même,
 * ou annuler cette livraison. */
export async function resolveRecurringPending(
  db: Db,
  restaurantId: string,
  id: string,
  action: "confirm" | "cancel_occurrence",
  now = new Date(),
): Promise<OccurrenceOutcome> {
  const row = await ownRecurring(db, restaurantId, id);
  const pending = row.pendingAction as Pending | null;
  if (row.status !== "problem" || !pending) fail("Aucune décision en attente.");
  // Réservation : un seul traitement de la décision.
  const [claimed] = await db
    .update(recurringOrders)
    .set({ status: "active", pendingAction: null, updatedAt: new Date() })
    .where(and(eq(recurringOrders.id, id), eq(recurringOrders.status, "problem")))
    .returning({ id: recurringOrders.id });
  if (!claimed) fail("Cette décision a déjà été prise.");
  if (action === "cancel_occurrence") {
    await event(db, id, {
      kind: "skipped",
      message: `Livraison du ${row.nextDeliveryOn} annulée par le restaurant.`,
    });
    await reschedule(db, row, addDaysIso(row.nextDeliveryOn ?? todayIso(now), 1), now);
    return "skipped";
  }
  return processOccurrence(
    db,
    { ...row, status: "active", pendingAction: null },
    now,
    pending.kind,
  );
}
