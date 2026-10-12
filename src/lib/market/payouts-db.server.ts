import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { checkouts, ledgerEntries, orders, payouts, refunds, users } from "@/db/schema";
import { formatFCFA } from "@/lib/format";
import { readBalances } from "./ledger-db.server";
import { audit, fail, nextNumber, notifyFinanceStaff, notifyUser } from "./market-common.server";
import { normalizeProviderRef } from "./payments-db.server";

// Argent qui sort, pendant le pilote : l'admin l'envoie à la main depuis le
// compte marchand Wave / Orange Money, puis saisit la référence de la
// transaction.
// - Versements : un producteur ou un livreur demande à retirer tout ou
//   partie de son solde ; la somme est réservée jusqu'au paiement.
// - Remboursements : ce que le restaurant a payé en trop (quantités
//   manquantes, annulation) ou refusé à la réception.

export const MIN_PAYOUT = 1000;

const METHOD_LABEL = { wave: "Wave", orange_money: "Orange Money" } as const;
export type PayoutMethod = keyof typeof METHOD_LABEL;

/** Numéro Wave / Orange Money au format 9 chiffres (77 123 45 67). */
export function normalizeWalletNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^221/, "");
  if (!/^7[05678]\d{7}$/.test(digits)) {
    fail("Numéro invalide : 9 chiffres commençant par 70, 75, 76, 77 ou 78.");
  }
  return digits;
}

export async function requestPayout(
  db: Db,
  userId: string,
  input: { amount: number; method: PayoutMethod; accountNumber?: string },
): Promise<{ reference: string }> {
  return db.transaction(async (tx) => {
    // Une demande à la fois par compte : deux demandes simultanées ne
    // peuvent pas réserver deux fois le même solde.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payout:${userId}`}))`);
    const [me] = await tx.select().from(users).where(eq(users.id, userId));
    if (!me || (me.role !== "farmer" && me.role !== "driver")) fail("Compte introuvable.");
    const amount = Math.round(input.amount);
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT) {
      fail(`Montant minimum : ${formatFCFA(MIN_PAYOUT)}.`);
    }
    const balance = (await readBalances(tx, [userId])).get(userId)!;
    if (amount > balance.available) {
      fail(`Solde disponible insuffisant : ${formatFCFA(balance.available)}.`);
    }
    const number = input.accountNumber?.trim()
      ? normalizeWalletNumber(input.accountNumber)
      : me.phone
        ? normalizeWalletNumber(me.phone)
        : fail("Indiquez le numéro qui recevra l'argent.");
    const reference = `VER-${await nextNumber(tx, "payout_reference_seq")}`;
    await tx.insert(payouts).values({
      reference,
      userId,
      amount,
      fee: 0,
      method: input.method,
      accountNumber: number,
      status: "requested",
    });
    await notifyFinanceStaff(tx, {
      type: "payment",
      title: "Retrait à verser",
      body: `${reference} · ${formatFCFA(amount)} par ${METHOD_LABEL[input.method]} à ${me.firstName} ${me.lastName}`,
      link: "/admin/payments",
    });
    return { reference };
  });
}

export async function payPayout(
  db: Db,
  adminId: string,
  payoutId: string,
  providerRef: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update");
    if (!p) fail("Retrait introuvable.");
    if (p.status !== "requested" && p.status !== "processing") {
      fail("Ce retrait n'est plus à verser.");
    }
    const ref = normalizeProviderRef(providerRef);
    const [owner] = await tx.select().from(users).where(eq(users.id, p.userId));
    const now = new Date();
    await tx
      .update(payouts)
      .set({ status: "paid", providerRef: ref, processedBy: adminId, paidAt: now, note: null })
      .where(eq(payouts.id, p.id));
    await tx.insert(ledgerEntries).values({
      account: owner.role === "driver" ? "driver" : "farmer",
      userId: p.userId,
      kind: "payout",
      amount: -p.amount,
      payoutId: p.id,
      note: `${p.reference ?? "Retrait"} · réf. ${ref}`,
    });
    await notifyUser(tx, p.userId, {
      type: "payment",
      title: "Retrait versé",
      body: `${p.reference ?? "Retrait"} : ${formatFCFA(p.amount)} envoyés sur votre ${
        METHOD_LABEL[p.method as PayoutMethod] ?? "compte"
      } (réf. ${ref})`,
      link: owner.role === "driver" ? "/driver/wallet" : "/farmer/revenue/withdrawals",
    });
    await audit(tx, {
      actorId: adminId,
      action: "Retrait versé",
      targetType: "payout",
      targetId: p.reference ?? p.id,
      before: { status: p.status },
      after: { status: "paid", amount: p.amount, providerRef: ref, to: p.accountNumber },
    });
  });
}

export async function rejectPayout(
  db: Db,
  adminId: string,
  payoutId: string,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update");
    if (!p) fail("Retrait introuvable.");
    if (p.status !== "requested" && p.status !== "processing") {
      fail("Ce retrait n'est plus à verser.");
    }
    await tx
      .update(payouts)
      .set({ status: "cancelled", processedBy: adminId, note: reason })
      .where(eq(payouts.id, p.id));
    const [owner] = await tx.select().from(users).where(eq(users.id, p.userId));
    await notifyUser(tx, p.userId, {
      type: "payment",
      title: "Retrait non versé",
      body: `${p.reference ?? "Retrait"} : ${reason}. Le montant est de nouveau disponible.`,
      link: owner.role === "driver" ? "/driver/wallet" : "/farmer/revenue/withdrawals",
    });
    await audit(tx, {
      actorId: adminId,
      action: "Retrait refusé",
      targetType: "payout",
      targetId: p.reference ?? p.id,
      before: { status: p.status, amount: p.amount },
      after: { status: "cancelled", reason },
    });
  });
}

/** L'admin a renvoyé l'argent au restaurant. */
export async function payRefund(
  db: Db,
  adminId: string,
  refundId: string,
  input: { method: PayoutMethod; paidTo: string; providerRef: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
    if (!r) fail("Remboursement introuvable.");
    if (r.status === "paid") fail("Ce remboursement est déjà fait.");
    if (r.status === "rejected") fail("Ce remboursement a été refusé.");
    // Séparation des tâches : qui a créé le remboursement ne le paie pas.
    if (r.createdBy === adminId) {
      fail("Un autre administrateur doit valider ce remboursement que vous avez créé.");
    }
    const ref = normalizeProviderRef(input.providerRef);
    const to = normalizeWalletNumber(input.paidTo);
    const now = new Date();
    await tx
      .update(refunds)
      .set({
        status: "paid",
        method: input.method,
        paidTo: to,
        providerRef: ref,
        approvedBy: adminId,
        paidAt: now,
      })
      .where(eq(refunds.id, r.id));
    const [o] = await tx.select().from(orders).where(eq(orders.id, r.orderId));
    await notifyUser(tx, o.restaurantId, {
      type: "payment",
      title: "Remboursement envoyé",
      body: `${r.reference} : ${formatFCFA(r.amount)} renvoyés par ${METHOD_LABEL[input.method]} (réf. ${ref})`,
      link: `/restaurant/orders/${o.id}`,
    });
    const [c] = await tx.select().from(checkouts).where(eq(checkouts.id, o.checkoutId));
    await audit(tx, {
      actorId: adminId,
      action: "Remboursement payé",
      targetType: "refund",
      targetId: r.reference,
      before: { status: r.status, amount: r.amount },
      after: { status: "paid", to, providerRef: ref, checkout: c?.reference },
    });
  });
}
