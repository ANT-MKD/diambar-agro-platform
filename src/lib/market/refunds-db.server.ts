import { eq, inArray } from "drizzle-orm";
import { ledgerEntries, refunds } from "@/db/schema";
import { formatFCFA } from "@/lib/format";
import { fail, nextNumber, notifyFinanceStaff, type Tx } from "./market-common.server";

// Remboursements créés par un dossier (retour, incident…) : le dossier et la
// retenue sur le solde de la partie qui paie sont écrits ensemble ; annuler un
// remboursement pas encore payé rend aussi la retenue.

export type Liable = "farmer" | "driver" | "platform";

export async function createRefund(
  tx: Tx,
  input: {
    orderId: string;
    source: "return" | "incident" | "manual";
    amount: number;
    bornBy: Liable;
    /** Compte débité (vide pour la plateforme). */
    liableUserId: string | null;
    missionId?: string | null;
    reason: string;
    createdBy: string | null;
    label: string;
  },
): Promise<{ id: string; reference: string }> {
  const amount = Math.round(input.amount);
  if (!(amount > 0)) fail("Montant du remboursement invalide.");
  if (input.bornBy !== "platform" && !input.liableUserId) fail("Partie qui paie introuvable.");
  const reference = `REM-${await nextNumber(tx, "refund_reference_seq")}`;
  const [refund] = await tx
    .insert(refunds)
    .values({
      reference,
      orderId: input.orderId,
      source: input.source,
      amount,
      bornBy: input.bornBy,
      status: "pending",
      reason: input.reason.slice(0, 500),
      createdBy: input.createdBy,
    })
    .returning({ id: refunds.id });
  await tx.insert(ledgerEntries).values({
    account: input.bornBy,
    userId: input.bornBy === "platform" ? null : input.liableUserId,
    kind: input.bornBy === "farmer" ? "refund_adjustment" : "adjustment",
    amount: -amount,
    orderId: input.orderId,
    missionId: input.missionId ?? null,
    refundId: refund.id,
    note: input.label,
  });
  await notifyFinanceStaff(
    tx,
    {
      type: "payment",
      title: "Remboursement à faire",
      body: `${reference} · ${formatFCFA(amount)} (${input.label})`,
      link: "/admin/payments",
    },
    "refunds.execute",
  );
  return { id: refund.id, reference };
}

/** Annule un remboursement pas encore payé et rend la retenue correspondante.
 * Renvoie false s'il a déjà été payé (rien n'est changé). */
export async function cancelRefund(tx: Tx, refundId: string, why: string): Promise<boolean> {
  const [r] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
  if (!r) return true;
  if (r.status === "paid") return false;
  if (r.status === "rejected") return true;
  await tx
    .update(refunds)
    .set({ status: "rejected", reason: `${r.reason ?? ""} — annulé : ${why}`.slice(0, 500) })
    .where(eq(refunds.id, refundId));
  const held = await tx
    .select()
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.refundId, [refundId]));
  for (const e of held) {
    await tx.insert(ledgerEntries).values({
      account: e.account,
      userId: e.userId,
      kind: e.kind,
      amount: -e.amount,
      orderId: e.orderId,
      missionId: e.missionId,
      refundId: e.refundId,
      note: `Annulation ${r.reference} · ${why}`.slice(0, 300),
    });
  }
  return true;
}
