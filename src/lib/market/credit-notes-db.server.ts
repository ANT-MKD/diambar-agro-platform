import { desc, eq, inArray, sql } from "drizzle-orm";
import { creditNotes, creditNoteUses, disputes, orders, restaurants } from "@/db/schema";
import type { CreditNote } from "@/data/disputes";
import { formatFCFA } from "@/lib/format";
import { fail, nextNumber, notifyUser, type Q, type Tx } from "./market-common.server";

// Avoirs : somme due à un restaurant (décision de litige), déduite de ses
// prochaines commandes. À l'émission, la partie responsable est débitée dans
// le grand livre (voir resolveDispute) ; à l'utilisation, la remise est portée
// par chaque commande (orders.discount), si bien que le montant à payer, les
// espèces à encaisser, les factures et les remboursements en tiennent compte.
// Une commande annulée ou réduite rend la part d'avoir qu'elle n'utilise plus.

export async function issueCreditNote(
  tx: Tx,
  input: {
    restaurantId: string;
    amount: number;
    disputeId: string | null;
    bornBy: "farmer" | "driver" | "platform";
    reason: string;
    createdBy: string;
  },
): Promise<{ id: string; reference: string }> {
  const amount = Math.round(input.amount);
  if (!(amount > 0)) fail("Montant de l'avoir invalide.");
  const reference = `AV-${String(await nextNumber(tx, "credit_note_reference_seq")).padStart(4, "0")}`;
  const [note] = await tx
    .insert(creditNotes)
    .values({
      reference,
      restaurantId: input.restaurantId,
      amount,
      balance: amount,
      disputeId: input.disputeId,
      bornBy: input.bornBy,
      reason: input.reason.slice(0, 500),
      createdBy: input.createdBy,
    })
    .returning({ id: creditNotes.id });
  await notifyUser(tx, input.restaurantId, {
    type: "payment",
    title: "Avoir disponible",
    body: `${reference} : ${formatFCFA(amount)} à déduire de vos prochaines commandes`,
    link: "/restaurant/checkout",
  });
  return { id: note.id, reference };
}

/** Répartit `amount` entre des parts proportionnelles à `weights` (somme
 * exacte, au franc près). */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || amount <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / total);
  const parts = raw.map(Math.floor);
  let rest = amount - parts.reduce((s, p) => s + p, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    parts[i] += 1;
    rest -= 1;
  }
  return parts;
}

/** Avoir choisi au panier : verrouillé, vérifié, et la part utilisée sur
 * chaque commande calculée (au plus ce qu'elle coûte). */
export async function reserveCredit(
  tx: Tx,
  restaurantId: string,
  creditNoteId: string,
  dues: number[],
): Promise<{ id: string; reference: string; parts: number[] }> {
  const [note] = await tx
    .select()
    .from(creditNotes)
    .where(eq(creditNotes.id, creditNoteId))
    .for("update");
  if (!note || note.restaurantId !== restaurantId) fail("Avoir introuvable.");
  if (note.status !== "active" || note.balance <= 0) fail(`L'avoir ${note.reference} est épuisé.`);
  if (note.expiresAt && note.expiresAt.getTime() < Date.now()) {
    fail(`L'avoir ${note.reference} a expiré.`);
  }
  const due = dues.reduce((s, d) => s + Math.max(0, d), 0);
  const used = Math.min(note.balance, due);
  return { id: note.id, reference: note.reference, parts: allocate(used, dues) };
}

/** Enregistre l'utilisation (une ligne par commande) et réduit le solde. */
export async function recordCreditUse(
  tx: Tx,
  creditNoteId: string,
  uses: { orderId: string; amount: number }[],
) {
  const list = uses.filter((u) => u.amount > 0);
  if (!list.length) return;
  await tx.insert(creditNoteUses).values(list.map((u) => ({ creditNoteId, ...u })));
  const used = list.reduce((s, u) => s + u.amount, 0);
  await tx
    .update(creditNotes)
    .set({
      balance: sql`${creditNotes.balance} - ${used}`,
      status: sql`case when ${creditNotes.balance} - ${used} <= 0 then 'used' else 'active' end::credit_note_status`,
      updatedAt: new Date(),
    })
    .where(eq(creditNotes.id, creditNoteId));
}

/** Rend à l'avoir jusqu'à `amount` de ce que la commande en a utilisé (les
 * utilisations les plus récentes d'abord). Renvoie ce qui a été rendu. */
export async function restoreCredit(tx: Tx, orderId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  const uses = await tx
    .select()
    .from(creditNoteUses)
    .where(eq(creditNoteUses.orderId, orderId))
    .orderBy(desc(creditNoteUses.createdAt))
    .for("update");
  let left = Math.round(amount);
  let restored = 0;
  for (const u of uses) {
    if (left <= 0) break;
    const back = Math.min(left, u.amount - u.restored);
    if (back <= 0) continue;
    await tx
      .update(creditNoteUses)
      .set({ restored: u.restored + back })
      .where(eq(creditNoteUses.id, u.id));
    await tx
      .update(creditNotes)
      .set({
        balance: sql`${creditNotes.balance} + ${back}`,
        status: sql`case when ${creditNotes.status} = 'cancelled' then 'cancelled' else 'active' end::credit_note_status`,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, u.creditNoteId));
    left -= back;
    restored += back;
  }
  return restored;
}

/** Part d'avoir encore utilisée par une commande. */
export async function creditUsedOn(q: Q, orderId: string): Promise<number> {
  const [row] = await q
    .select({
      used: sql<number>`coalesce(sum(${creditNoteUses.amount} - ${creditNoteUses.restored}), 0)::int`,
    })
    .from(creditNoteUses)
    .where(eq(creditNoteUses.orderId, orderId));
  return Number(row?.used ?? 0);
}

/** Commande annulée ou réduite : elle garde au plus `keep` de remise, le
 * reste retourne à l'avoir. */
export async function releaseOrderCredit(
  tx: Tx,
  o: { id: string; discount: number },
  keep: number,
): Promise<number> {
  const cap = Math.max(0, Math.round(keep));
  if (o.discount <= cap) return 0;
  const restored = await restoreCredit(tx, o.id, o.discount - cap);
  await tx
    .update(orders)
    .set({ discount: o.discount - restored, updatedAt: new Date() })
    .where(eq(orders.id, o.id));
  return restored;
}

/** Avoirs tels que les écrans les affichent : ceux du restaurant, ou tous
 * pour l'équipe. */
export async function readCreditNotes(
  q: Q,
  me: { id: string; role: "restaurant" | "farmer" | "driver" | "admin" },
): Promise<CreditNote[]> {
  if (me.role !== "restaurant" && me.role !== "admin") return [];
  const rows = await q
    .select({
      note: creditNotes,
      restaurantName: restaurants.name,
      disputeRef: disputes.reference,
    })
    .from(creditNotes)
    .innerJoin(restaurants, eq(restaurants.userId, creditNotes.restaurantId))
    .leftJoin(disputes, eq(disputes.id, creditNotes.disputeId))
    .where(me.role === "restaurant" ? eq(creditNotes.restaurantId, me.id) : undefined)
    .orderBy(desc(creditNotes.createdAt))
    .limit(300);
  if (!rows.length) return [];
  const uses = await q
    .select({
      creditNoteId: creditNoteUses.creditNoteId,
      amount: creditNoteUses.amount,
      restored: creditNoteUses.restored,
      at: creditNoteUses.createdAt,
      orderRef: orders.reference,
    })
    .from(creditNoteUses)
    .innerJoin(orders, eq(orders.id, creditNoteUses.orderId))
    .where(
      inArray(
        creditNoteUses.creditNoteId,
        rows.map((r) => r.note.id),
      ),
    );
  return rows.map(({ note, restaurantName, disputeRef }) => {
    const mine = uses
      .filter((u) => u.creditNoteId === note.id && u.amount > u.restored)
      .map((u) => ({
        orderRef: u.orderRef,
        amount: u.amount - u.restored,
        at: u.at.toISOString(),
      }));
    return {
      id: note.id,
      reference: note.reference,
      source: "dispute" as const,
      disputeId: note.disputeId ?? undefined,
      beneficiaryRole: "restaurant" as const,
      beneficiaryName: restaurantName,
      amount: note.balance,
      initialAmount: note.amount,
      at: note.createdAt.toISOString(),
      expiresAt: note.expiresAt?.toISOString(),
      status:
        note.balance > 0 && note.status === "active" ? ("issued" as const) : ("applied" as const),
      usedOnOrderRef: mine[mine.length - 1]?.orderRef,
      usages: mine,
      reason: note.reason ?? (disputeRef ? `Litige ${disputeRef}` : undefined),
    };
  });
}
