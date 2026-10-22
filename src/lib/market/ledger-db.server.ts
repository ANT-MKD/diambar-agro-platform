import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { ledgerEntries, missionEvents, payments, payouts, settings } from "@/db/schema";
import { driverCommissionForPayout, tierRateForVolume } from "@/lib/commission";
import { WAIT_PAY_NOTE, waitCompensation } from "@/lib/mission-eligibility";
import type { Q, Tx } from "./market-common.server";
import { readDriverPay } from "./rules-db.server";

// Grand livre : ce que Diambar doit à chaque producteur et à chaque livreur,
// et ce que la plateforme garde. Le solde d'un compte est la somme de ses
// écritures (positif = dû au compte). Les écritures ne sont jamais modifiées :
// une correction est une nouvelle écriture.
//
// À la livraison d'une commande (le restaurant a payé : compte marchand
// confirmé, ou espèces encaissées par le livreur) :
//   producteur : + marchandise livrée, − commission (barème par palier)
//   livreur    : + prix de la course,  − commission livreur (taux réglé dans
//                « Tarifs de livraison »), + attente payée s'il a attendu
//   plateforme : + les deux commissions + frais de livraison − prix de la course
//                − attente payée (à la charge de Diambar)
// La somme des trois est exactement ce que le restaurant a payé.

type Tier = { min: number; max: number | null; rate: number };

const DEFAULT_TIERS: Tier[] = [{ min: 0, max: null, rate: 15 }];

export async function readCommissionTiers(q: Q): Promise<Tier[]> {
  const [row] = await q
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "commission_tiers"));
  const tiers = (row?.value as Tier[] | undefined)?.filter(
    (t) => typeof t?.rate === "number" && typeof t?.min === "number",
  );
  return tiers?.length ? [...tiers].sort((a, b) => a.min - b.min) : DEFAULT_TIERS;
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Volume déjà livré par le producteur ce mois-ci (base du palier). */
async function monthVolume(q: Q, farmerId: string, now: Date): Promise<number> {
  const [row] = await q
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "farmer"),
        eq(ledgerEntries.userId, farmerId),
        eq(ledgerEntries.kind, "sale"),
        gte(ledgerEntries.createdAt, startOfMonth(now)),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Écritures de la livraison d'une commande (une seule fois par commande). */
export async function recordDelivery(
  tx: Tx,
  o: { id: string; reference: string; farmerId: string; subtotal: number; deliveryFee: number },
  m: { id: string; reference: string; driverId: string; payout: number },
): Promise<{ farmerCommission: number; rate: number; waitPay: number }> {
  const [already] = await tx
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.orderId, o.id), eq(ledgerEntries.kind, "sale")))
    .limit(1);
  if (already) return { farmerCommission: 0, rate: 0, waitPay: 0 };
  const now = new Date();
  const tiers = await readCommissionTiers(tx);
  const rate = tierRateForVolume(tiers, (await monthVolume(tx, o.farmerId, now)) + o.subtotal);
  const farmerCommission = Math.round((o.subtotal * rate) / 100);
  const driverRate = (await readDriverPay(tx)).commissionRate;
  const driverCommission = driverCommissionForPayout(m.payout, driverRate);
  const wait = await waitPayForMission(tx, m.id, now);
  const rows: (typeof ledgerEntries.$inferInsert)[] = [
    { account: "farmer", userId: o.farmerId, kind: "sale", amount: o.subtotal, orderId: o.id },
    {
      account: "farmer",
      userId: o.farmerId,
      kind: "commission",
      amount: -farmerCommission,
      orderId: o.id,
      note: `Commission ${rate} %`,
    },
    {
      account: "driver",
      userId: m.driverId,
      kind: "driver_payout",
      amount: m.payout,
      orderId: o.id,
      missionId: m.id,
    },
    {
      account: "driver",
      userId: m.driverId,
      kind: "commission",
      amount: -driverCommission,
      orderId: o.id,
      missionId: m.id,
      note: `Commission livreur ${driverRate} %`,
    },
    {
      account: "platform",
      kind: "commission",
      amount: farmerCommission,
      orderId: o.id,
      note: "Commission producteur",
    },
    {
      account: "platform",
      kind: "commission",
      amount: driverCommission,
      orderId: o.id,
      missionId: m.id,
      note: "Commission livreur",
    },
    { account: "platform", kind: "delivery_fee", amount: o.deliveryFee, orderId: o.id },
    {
      account: "platform",
      kind: "driver_payout",
      amount: -m.payout,
      orderId: o.id,
      missionId: m.id,
    },
    // Attente payée : versée au livreur, à la charge de Diambar.
    {
      account: "driver",
      userId: m.driverId,
      kind: "adjustment",
      amount: wait.amount,
      orderId: o.id,
      missionId: m.id,
      note: `${WAIT_PAY_NOTE} · ${m.reference} · ${wait.detail}`,
    },
    {
      account: "platform",
      kind: "adjustment",
      amount: -wait.amount,
      orderId: o.id,
      missionId: m.id,
      note: `${WAIT_PAY_NOTE} · ${m.reference}`,
    },
  ];
  // Une écriture à zéro n'apporte rien (et la base les refuse).
  await tx.insert(ledgerEntries).values(rows.filter((r) => r.amount !== 0));
  return { farmerCommission, rate, waitPay: wait.amount };
}

/**
 * Attente payée d'une course : de l'arrivée signalée par le livreur
 * (« Je suis chez le producteur / le restaurant ») jusqu'au chargement, puis
 * jusqu'à la livraison. Au-delà de 10 minutes, chaque minute est payée.
 */
async function waitPayForMission(
  tx: Tx,
  missionId: string,
  now: Date,
): Promise<{ amount: number; detail: string }> {
  const events = await tx
    .select({ status: missionEvents.status, note: missionEvents.note, at: missionEvents.at })
    .from(missionEvents)
    .where(eq(missionEvents.missionId, missionId));
  const first = (pick: (e: (typeof events)[number]) => boolean) =>
    events
      .filter(pick)
      .map((e) => e.at)
      .sort((a, b) => a.getTime() - b.getTime())[0];
  let amount = 0;
  const parts: string[] = [];
  for (const [stage, end, where] of [
    ["pickup", "loaded", "chez le producteur"],
    ["dropoff", "delivered", "au restaurant"],
  ] as const) {
    const arrived = first((e) => e.note === `arrivee:${stage}`);
    if (!arrived) continue;
    const ended = first((e) => e.status === end) ?? now;
    const minutes = Math.floor((ended.getTime() - arrived.getTime()) / 60_000);
    const pay = waitCompensation(minutes);
    if (pay <= 0) continue;
    amount += pay;
    parts.push(`${minutes} min ${where}`);
  }
  return { amount, detail: parts.join(", ") };
}

/** Refus à la réception : le producteur rend ce qui a été refusé, la
 * plateforme lui rend la commission correspondante. */
export async function recordReceptionRefusal(
  tx: Tx,
  o: { id: string; farmerId: string; subtotal: number },
  refused: number,
  refundId: string | null,
) {
  if (refused <= 0) return;
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.orderId, o.id),
        eq(ledgerEntries.account, "farmer"),
        eq(ledgerEntries.kind, "commission"),
      ),
    );
  const commission = -Number(row?.total ?? 0);
  const back = o.subtotal > 0 ? Math.round((commission * refused) / o.subtotal) : 0;
  const rows: (typeof ledgerEntries.$inferInsert)[] = [
    {
      account: "farmer",
      userId: o.farmerId,
      kind: "refund_adjustment",
      amount: -refused,
      orderId: o.id,
      refundId,
      note: "Refusé à la réception",
    },
    {
      account: "farmer",
      userId: o.farmerId,
      kind: "commission",
      amount: back,
      orderId: o.id,
      refundId,
      note: "Commission rendue (refus à la réception)",
    },
    {
      account: "platform",
      kind: "commission",
      amount: -back,
      orderId: o.id,
      refundId,
      note: "Commission rendue au producteur",
    },
  ];
  await tx.insert(ledgerEntries).values(rows.filter((r) => r.amount !== 0));
}

export type AccountBalance = {
  /** Somme des écritures (versements payés déjà déduits). */
  balance: number;
  /** Retraits demandés, pas encore payés : réservés. */
  reserved: number;
  /** Livreur : espèces encaissées chez les restaurants, pas encore remises
   * à Diambar. Elles sont retenues sur ce qu'il peut retirer. */
  cashHeld: number;
  /** Ce qui peut encore être retiré. */
  available: number;
};

/** Espèces encaissées par chaque livreur et pas encore remises. */
export async function readCashHeld(q: Q, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await q
    .select({ userId: payments.collectedBy, total: sql<number>`sum(${payments.amount})::int` })
    .from(payments)
    .where(
      and(
        inArray(payments.collectedBy, userIds),
        eq(payments.status, "pending"),
        sql`${payments.collectedAt} is not null`,
      ),
    )
    .groupBy(payments.collectedBy);
  return new Map(rows.flatMap((r) => (r.userId ? [[r.userId, Number(r.total) || 0]] : [])));
}

/** Soldes de plusieurs comptes producteur / livreur. */
export async function readBalances(q: Q, userIds: string[]): Promise<Map<string, AccountBalance>> {
  const out = new Map<string, AccountBalance>();
  if (userIds.length === 0) return out;
  const sums = await q
    .select({
      userId: ledgerEntries.userId,
      total: sql<number>`sum(${ledgerEntries.amount})::int`,
    })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.userId, userIds))
    .groupBy(ledgerEntries.userId);
  const held = await q
    .select({ userId: payouts.userId, total: sql<number>`sum(${payouts.amount})::int` })
    .from(payouts)
    .where(
      and(inArray(payouts.userId, userIds), inArray(payouts.status, ["requested", "processing"])),
    )
    .groupBy(payouts.userId);
  const cash = await readCashHeld(q, userIds);
  for (const id of userIds) {
    const balance = Number(sums.find((s) => s.userId === id)?.total ?? 0);
    const reserved = Number(held.find((h) => h.userId === id)?.total ?? 0);
    const cashHeld = cash.get(id) ?? 0;
    out.set(id, {
      balance,
      reserved,
      cashHeld,
      available: Math.max(0, balance - reserved - cashHeld),
    });
  }
  return out;
}
