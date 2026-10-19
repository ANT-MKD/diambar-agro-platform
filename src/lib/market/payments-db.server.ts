import { and, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { checkouts, missions, orders, payments, refunds, settings } from "@/db/schema";
import { formatFCFA } from "@/lib/format";
import {
  audit,
  fail,
  nextNumber,
  notifyFinanceStaff,
  notifyUser,
  type Q,
  type Tx,
} from "./market-common.server";

// Paiements du pilote, sans paiement intégré (pas encore d'API Wave ni
// Orange Money) :
// - Wave / Orange Money : le restaurant paie le panier sur le numéro
//   marchand de Diambar, puis déclare la référence de la transaction.
//   L'admin la retrouve sur le compte marchand et confirme. Tant que ce
//   n'est pas fait, la commande n'est pas préparée et aucune course ne part ;
// - espèces : chaque commande est réglée à son livreur à la livraison.
//   L'admin confirme quand le livreur lui a remis l'argent.
// Si un panier déjà payé diminue (producteur qui n'a pas tout, commande
// annulée), la différence devient un remboursement à faire au restaurant.

type OrderRow = typeof orders.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export type MerchantAccounts = {
  wave: string | null;
  orangeMoney: string | null;
  cash: boolean;
  /** Espèces non remises au-delà desquelles un livreur n'accepte plus de
   * course payée en espèces. */
  driverCashLimit: number;
  /** Retraits et remboursements à partir de ce montant : un admin valide,
   * un autre envoie l'argent (0 = pas de double validation). */
  approvalThreshold: number;
};

export const DEFAULT_DRIVER_CASH_LIMIT = 50_000;
export const DEFAULT_APPROVAL_THRESHOLD = 100_000;

/** Numéros marchands ouverts par l'admin (Paramètres → Paiements). */
export async function readMerchantAccounts(q: Q): Promise<MerchantAccounts> {
  const [row] = await q
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "payment_methods"));
  const v = row?.value as
    | {
        wave?: { enabled?: boolean; number?: string };
        orangeMoney?: { enabled?: boolean; number?: string };
        cashOnDelivery?: { enabled?: boolean; driverLimit?: number };
        approvalThreshold?: number;
      }
    | undefined;
  const limit = v?.cashOnDelivery?.driverLimit;
  const number = (x?: { enabled?: boolean; number?: string }) =>
    x?.enabled && x.number?.trim() ? x.number.trim() : null;
  return {
    wave: number(v?.wave),
    orangeMoney: number(v?.orangeMoney),
    cash: !!v?.cashOnDelivery?.enabled,
    driverCashLimit:
      typeof limit === "number" && Number.isFinite(limit) && limit >= 0
        ? limit
        : DEFAULT_DRIVER_CASH_LIMIT,
    approvalThreshold:
      typeof v?.approvalThreshold === "number" && v.approvalThreshold >= 0
        ? v.approvalThreshold
        : DEFAULT_APPROVAL_THRESHOLD,
  };
}

/** Ce que le restaurant doit pour une commande (rien si elle est annulée). */
export function orderDue(o: Pick<OrderRow, "status" | "subtotal" | "deliveryFee" | "discount">) {
  return o.status === "cancelled" ? 0 : Math.max(0, o.subtotal + o.deliveryFee - o.discount);
}

/** Paiement Wave / Orange Money d'un panier (le plus récent). */
async function checkoutPayment(q: Q, checkoutId: string, lock = false) {
  const query = q
    .select()
    .from(payments)
    .where(and(eq(payments.checkoutId, checkoutId), isNull(payments.orderId)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  const [p] = lock ? await query.for("update") : await query;
  return p as PaymentRow | undefined;
}

async function cashPayment(q: Q, orderId: string) {
  const [p] = await q
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return p as PaymentRow | undefined;
}

async function checkoutMode(q: Q, checkoutId: string) {
  const [c] = await q
    .select({ mode: checkouts.paymentMode })
    .from(checkouts)
    .where(eq(checkouts.id, checkoutId));
  return c?.mode ?? "prepaid";
}

/** La course peut-elle partir ? Oui en espèces ; avec Wave / Orange Money,
 * seulement une fois le paiement confirmé par l'admin. */
export async function paymentAllowsDelivery(q: Q, o: OrderRow): Promise<boolean> {
  if ((await checkoutMode(q, o.checkoutId)) !== "prepaid") return true;
  const p = await checkoutPayment(q, o.checkoutId);
  return p?.status === "confirmed";
}

/** Après un changement de montant (confirmation partielle, annulation) :
 * le montant à payer suit tant que rien n'est déclaré ; une fois payé, la
 * différence devient un remboursement. */
export async function syncPayments(tx: Tx, checkoutId: string) {
  const mode = await checkoutMode(tx, checkoutId);
  const list = await tx.select().from(orders).where(eq(orders.checkoutId, checkoutId));
  if (mode !== "prepaid") {
    for (const o of list) {
      const p = await cashPayment(tx, o.id);
      if (!p || p.status !== "pending" || p.collectedAt) continue;
      const due = orderDue(o);
      await tx
        .update(payments)
        .set(
          due > 0
            ? { amount: due, updatedAt: new Date() }
            : { status: "cancelled", updatedAt: new Date() },
        )
        .where(eq(payments.id, p.id));
    }
    return;
  }
  const p = await checkoutPayment(tx, checkoutId, true);
  if (!p) return;
  if (p.status === "confirmed") {
    await refundOverpayment(tx, checkoutId, p);
    return;
  }
  const declared = p.status === "pending" && !!p.declaredAt;
  if (declared || p.status === "cancelled" || p.status === "refunded") return;
  // Rien de déclaré (ou déclaration refusée) : le montant à payer suit.
  const due = list.reduce((s, o) => s + orderDue(o), 0);
  await tx
    .update(payments)
    .set(
      due > 0
        ? { amount: due, updatedAt: new Date() }
        : { status: "cancelled", updatedAt: new Date() },
    )
    .where(eq(payments.id, p.id));
}

/** Panier payé : ce qui a été payé en trop sur chaque commande (quantités
 * manquantes, annulation) devient un remboursement à faire au restaurant.
 * Personne ne « supporte » ces remboursements : le producteur n'est payé
 * que sur ce qu'il livre. */
export async function refundOverpayment(tx: Tx, checkoutId: string, p: PaymentRow) {
  const list = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.checkoutId, checkoutId), isNotNull(orders.paymentShare)));
  if (list.length === 0) return;
  const already = await tx
    .select({ orderId: refunds.orderId, total: sql<number>`sum(${refunds.amount})::int` })
    .from(refunds)
    .where(
      and(
        inArray(
          refunds.orderId,
          list.map((o) => o.id),
        ),
        inArray(refunds.source, ["shortage", "cancellation"]),
        ne(refunds.status, "rejected"),
      ),
    )
    .groupBy(refunds.orderId);
  const refunded = new Map(already.map((r) => [r.orderId, Number(r.total) || 0]));
  for (const o of list) {
    const extra = (o.paymentShare ?? 0) - orderDue(o) - (refunded.get(o.id) ?? 0);
    if (extra <= 0) continue;
    const cancelled = o.status === "cancelled";
    const reference = `REM-${await nextNumber(tx, "refund_reference_seq")}`;
    await tx.insert(refunds).values({
      reference,
      orderId: o.id,
      source: cancelled ? "cancellation" : "shortage",
      amount: extra,
      bornBy: "platform",
      method: p.method,
      status: "pending",
      reason: cancelled
        ? `Commande ${o.reference} annulée après paiement`
        : `Quantités manquantes sur ${o.reference} après paiement`,
    });
    await notifyUser(tx, o.restaurantId, {
      type: "payment",
      title: "Remboursement prévu",
      body: `${reference} : ${formatFCFA(extra)} vous seront renvoyés pour ${o.reference}`,
      link: `/restaurant/orders/${o.id}`,
    });
    await notifyFinanceStaff(
      tx,
      {
        type: "payment",
        title: "Remboursement à faire",
        body: `${reference} · ${formatFCFA(extra)} à renvoyer (${o.reference})`,
        link: "/admin/payments",
      },
      "refunds.execute",
    );
  }
}

// --- Espèces : encaissement par le livreur ----------------------------------------------

/** Montant à encaisser en espèces pour une commande (0 si payée autrement). */
export async function cashToCollect(q: Q, o: OrderRow): Promise<number> {
  if ((await checkoutMode(q, o.checkoutId)) === "prepaid") return 0;
  const p = await cashPayment(q, o.id);
  if (!p || p.status !== "pending" || p.collectedAt) return 0;
  return orderDue(o);
}

/** Espèces que le livreur va encaisser sur ses courses en cours. */
export async function cashCommitted(q: Q, driverId: string): Promise<number> {
  const [row] = await q
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .innerJoin(missions, eq(missions.orderId, payments.orderId))
    .where(
      and(
        eq(missions.driverId, driverId),
        inArray(missions.status, ["accepted", "pickup", "loaded"]),
        eq(payments.status, "pending"),
        isNull(payments.collectedAt),
      ),
    );
  return Number(row?.total ?? 0);
}

/** À la remise : le livreur a encaissé les espèces de la commande. */
export async function recordCashCollected(tx: Tx, o: OrderRow, driverId: string) {
  const p = await cashPayment(tx, o.id);
  if (!p || p.status !== "pending" || p.collectedAt) return;
  const due = orderDue(o);
  await tx
    .update(payments)
    .set({
      collectedBy: driverId,
      collectedAt: new Date(),
      ...(due > 0 ? { amount: due } : {}),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, p.id));
}

// --- Wave / Orange Money : déclaration par le restaurant --------------------------------

const PREPAID = { wave: "Wave", orange_money: "Orange Money" } as const;
export type PrepaidMethod = keyof typeof PREPAID;

/** Référence de transaction : lettres, chiffres, points, tirets. */
export function normalizeProviderRef(raw: string): string {
  const ref = raw.trim().replace(/\s+/g, "").toUpperCase();
  if (ref.length < 4 || ref.length > 64 || !/^[A-Z0-9._-]+$/.test(ref)) {
    fail(
      "Référence invalide : recopiez l'identifiant de la transaction indiqué dans le SMS ou l'application (lettres et chiffres).",
    );
  }
  return ref;
}

export async function declarePayment(
  db: Db,
  restaurantId: string,
  input: { checkoutId: string; method: PrepaidMethod; providerRef: string },
): Promise<{ amount: number }> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(checkouts).where(eq(checkouts.id, input.checkoutId));
    if (!c || c.restaurantId !== restaurantId) fail("Panier introuvable.");
    if (c.paymentMode !== "prepaid") {
      fail("Paiement en espèces : réglez le livreur au moment de la livraison.");
    }
    const p = await checkoutPayment(tx, c.id, true);
    if (!p) fail("Paiement introuvable : contactez le support.");
    if (p.status === "confirmed") fail("Ce paiement est déjà confirmé.");
    if (p.status === "cancelled" || p.status === "refunded") {
      fail("Plus rien à payer sur ce panier : les commandes ont été annulées.");
    }
    const accounts = await readMerchantAccounts(tx);
    const number = input.method === "wave" ? accounts.wave : accounts.orangeMoney;
    if (!number) fail(`${PREPAID[input.method]} n'est pas proposé pour le moment.`);
    const ref = normalizeProviderRef(input.providerRef);
    const [taken] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.method, input.method),
          eq(payments.providerRef, ref),
          ne(payments.id, p.id),
        ),
      );
    if (taken) fail("Cette référence a déjà été déclarée pour un autre paiement.");

    const list = await tx.select().from(orders).where(eq(orders.checkoutId, c.id));
    const due = list.reduce((s, o) => s + orderDue(o), 0);
    if (due <= 0) fail("Plus rien à payer sur ce panier : les commandes ont été annulées.");
    // Part de chaque commande dans ce qui est payé : base des remboursements.
    for (const o of list) {
      await tx
        .update(orders)
        .set({ paymentShare: orderDue(o) })
        .where(eq(orders.id, o.id));
    }
    await tx
      .update(payments)
      .set({
        method: input.method,
        providerRef: ref,
        amount: due,
        status: "pending",
        declaredAt: new Date(),
        declaredBy: restaurantId,
        note: null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, p.id));
    await notifyFinanceStaff(tx, {
      type: "payment",
      title: "Paiement à vérifier",
      body: `${c.reference} · ${formatFCFA(due)} par ${PREPAID[input.method]} (réf. ${ref})`,
      link: "/admin/payments",
    });
    return { amount: due };
  });
}

/** L'admin ne retrouve pas la transaction : le restaurant est prévenu et
 * peut déclarer à nouveau. */
export async function rejectPayment(
  db: Db,
  adminId: string,
  paymentId: string,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p) fail("Paiement introuvable.");
    if (p.orderId) fail("Les espèces se confirment à la remise par le livreur.");
    if (p.status !== "pending" || !p.declaredAt) {
      fail("Seul un paiement déclaré et pas encore confirmé peut être refusé.");
    }
    await tx
      .update(payments)
      .set({ status: "failed", note: reason, updatedAt: new Date() })
      .where(eq(payments.id, p.id));
    const [c] = await tx.select().from(checkouts).where(eq(checkouts.id, p.checkoutId));
    const [first] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.checkoutId, p.checkoutId))
      .limit(1);
    await notifyUser(tx, c.restaurantId, {
      type: "payment",
      title: "Paiement non retrouvé",
      body: `${c.reference} : ${reason}. Vérifiez la référence et déclarez à nouveau.`,
      link: first ? `/restaurant/orders/${first.id}` : "/restaurant/orders",
    });
    await audit(tx, {
      actorId: adminId,
      action: "Paiement refusé",
      targetType: "payment",
      targetId: c.reference,
      before: { status: "pending", providerRef: p.providerRef, amount: p.amount },
      after: { status: "failed", reason },
    });
  });
}
