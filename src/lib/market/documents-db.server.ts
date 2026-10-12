import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  checkouts,
  farmers,
  invoices,
  ledgerEntries,
  missions,
  orderItems,
  orders,
  payments,
  payouts,
  refunds,
  restaurants,
  settings,
  users,
} from "@/db/schema";
import { formatFCFA } from "@/lib/format";
import type { CompanyInfo, TvaSetting } from "@/lib/platform/setup-model";
import { fail, notifyUser, type Q, type Tx } from "./market-common.server";
import type { InvoiceContent, StatementView } from "./documents-view";

// Documents comptables tirés de la base :
// - la facture du restaurant, une par panier, émise quand tout est livré
//   (ou annulé) et que le contrôle à la réception est fait ou expiré : elle
//   porte alors les quantités réellement acceptées. Numérotation continue,
//   sans trou (FAC-2026-00001…), contenu figé à l'émission ;
// - le relevé mensuel d'un producteur ou d'un livreur, tiré du grand livre.

const PAYMENT_LABEL: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  cash: "Espèces",
  transfer: "Virement",
};

async function settingValue<T>(q: Q, key: string): Promise<T | undefined> {
  const [row] = await q
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key));
  return row?.value as T | undefined;
}

/** Vendeur imprimé sur les documents (Paramètres → Entreprise). */
async function seller(q: Q): Promise<InvoiceContent["seller"]> {
  const c = await settingValue<CompanyInfo>(q, "company");
  return {
    name: c?.legalName?.trim() || "Diambar Agro",
    tradeName: c?.tradeName?.trim() || undefined,
    address: c?.address?.trim() || "Dakar, Sénégal",
    email: c?.email?.trim() || "",
    phone: c?.phone?.trim() || "",
    ninea: c?.ninea?.trim() || "",
    rccm: c?.rccm?.trim() || "",
  };
}

/** Prochain numéro de facture, sans trou : compteur verrouillé dans la
 * transaction (une transaction annulée ne consomme pas de numéro). */
async function nextInvoiceNumber(tx: Tx, now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  await tx
    .insert(settings)
    .values({ key: "invoice_counter", value: { year, last: 0 } })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "invoice_counter"))
    .for("update");
  const v = row.value as { year: number; last: number };
  const n = v.year === year ? v.last + 1 : 1;
  await tx
    .update(settings)
    .set({ value: { year, last: n }, updatedAt: now })
    .where(eq(settings.key, "invoice_counter"));
  return `FAC-${year}-${String(n).padStart(5, "0")}`;
}

/** Paniers prêts à facturer : rien en cours, au moins une commande livrée,
 * contrôle à la réception fait ou délai passé. */
export async function issueDueInvoices(db: Db, now = new Date()): Promise<number> {
  const due = (await db.execute(sql`
    select c.id from checkouts c
    where not exists (select 1 from invoices i where i.checkout_id = c.id)
      and exists (select 1 from orders o where o.checkout_id = c.id and o.status = 'delivered')
      and not exists (
        select 1 from orders o
        where o.checkout_id = c.id and o.status not in ('delivered', 'cancelled')
      )
      and not exists (
        select 1 from orders o
        where o.checkout_id = c.id and o.status = 'delivered' and o.reception_at is null
          and (o.reception_deadline is null or o.reception_deadline > ${now.toISOString()}::timestamptz)
      )
    order by c.created_at
    limit 50
  `)) as unknown as { id: string }[];
  let issued = 0;
  for (const { id } of due) {
    try {
      if (await db.transaction((tx) => issueInvoice(tx, id, now))) issued++;
    } catch (err) {
      console.error("[factures]", id, err);
    }
  }
  return issued;
}

async function issueInvoice(tx: Tx, checkoutId: string, now: Date): Promise<boolean> {
  const [already] = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.checkoutId, checkoutId));
  if (already) return false;
  const [c] = await tx.select().from(checkouts).where(eq(checkouts.id, checkoutId));
  if (!c) return false;
  const list = await tx
    .select()
    .from(orders)
    .where(eq(orders.checkoutId, checkoutId))
    .orderBy(asc(orders.reference));
  const delivered = list.filter((o) => o.status === "delivered");
  if (delivered.length === 0) return false;
  const [resto] = await tx
    .select({ name: restaurants.name, address: restaurants.address, phone: users.phone })
    .from(restaurants)
    .innerJoin(users, eq(users.id, restaurants.userId))
    .where(eq(restaurants.userId, c.restaurantId));
  const farmerRows = await tx
    .select({
      id: farmers.userId,
      farm: farmers.farmName,
      first: users.firstName,
      last: users.lastName,
    })
    .from(farmers)
    .innerJoin(users, eq(users.id, farmers.userId))
    .where(
      inArray(
        farmers.userId,
        delivered.map((o) => o.farmerId),
      ),
    );
  const farmerName = (id: string) => {
    const f = farmerRows.find((x) => x.id === id);
    return f ? f.farm || `${f.first} ${f.last}`.trim() : "Producteur";
  };
  const items = await tx
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        delivered.map((o) => o.id),
      ),
    );
  const lines: InvoiceContent["lines"] = [];
  for (const o of delivered) {
    for (const i of items.filter((x) => x.orderId === o.id)) {
      const qty =
        Math.round((Number(i.qtyConfirmed ?? i.qtyOrdered) - Number(i.qtyRefused ?? 0)) * 1000) /
        1000;
      if (qty <= 0) continue;
      lines.push({
        name: i.productName,
        unit: i.unit,
        qty,
        unitPrice: i.unitPrice,
        amount: Math.round(qty * i.unitPrice),
        orderRef: o.reference,
        farmerName: farmerName(o.farmerId),
      });
    }
  }
  const deliveryFees = delivered
    .filter((o) => o.deliveryFee > 0)
    .map((o) => ({ orderRef: o.reference, amount: o.deliveryFee }));
  const discount = delivered.reduce((s, o) => s + o.discount, 0);
  const ttc =
    lines.reduce((s, l) => s + l.amount, 0) +
    deliveryFees.reduce((s, f) => s + f.amount, 0) -
    discount;
  const tva = await settingValue<TvaSetting>(tx, "tva");
  const rate = tva?.enabled && tva.rate > 0 ? tva.rate : 0;
  const ht = rate > 0 ? Math.round((ttc * 100) / (100 + rate)) : ttc;

  const pays = await tx.select().from(payments).where(eq(payments.checkoutId, checkoutId));
  const paid = pays.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const collected = pays
    .filter((p) => p.status === "pending" && p.collectedAt)
    .reduce((s, p) => s + p.amount, 0);
  const back = await tx
    .select({ total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
    .from(refunds)
    .where(
      and(
        inArray(
          refunds.orderId,
          list.map((o) => o.id),
        ),
        ne(refunds.status, "rejected"),
      ),
    );
  const method = pays.find((p) => !p.orderId)?.method ?? pays[0]?.method ?? "wave";

  const content: InvoiceContent = {
    seller: await seller(tx),
    buyer: {
      name: resto?.name ?? "Restaurant",
      address: c.deliveryAddress || resto?.address || "",
      phone: resto?.phone ?? "",
    },
    checkoutReference: c.reference,
    orders: delivered.map((o) => ({
      reference: o.reference,
      farmerName: farmerName(o.farmerId),
      deliveredAt: o.deliveredAt?.toISOString(),
    })),
    lines,
    deliveryFees,
    discount,
    totals: { ht, tvaRate: rate, tva: ttc - ht, ttc },
    payment: {
      method: PAYMENT_LABEL[method] ?? "Wave",
      paid: paid + collected,
      refunded: Number(back[0]?.total ?? 0),
    },
  };
  const number = await nextInvoiceNumber(tx, now);
  await tx.insert(invoices).values({
    number,
    checkoutId,
    issuedAt: now,
    totalHt: ht,
    tvaRate: rate,
    tvaAmount: ttc - ht,
    totalTtc: ttc,
    content,
  });
  await notifyUser(tx, c.restaurantId, {
    type: "payment",
    title: "Facture disponible",
    body: `${number} · ${c.reference} · ${formatFCFA(ttc)}`,
    link: "/restaurant/invoices",
  });
  return true;
}

// --- Relevé mensuel (producteur, livreur) ----------------------------------------------

const KIND_LABEL: Record<string, string> = {
  sale: "Vente",
  commission: "Commission",
  delivery_fee: "Frais de livraison",
  driver_payout: "Course",
  refund_adjustment: "Refus à la réception",
  payout: "Retrait versé",
  adjustment: "Ajustement",
};

export async function readStatement(db: Db, userId: string, month: string): Promise<StatementView> {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) fail("Mois invalide.");
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  const [me] = await db
    .select({ role: users.role, first: users.firstName, last: users.lastName, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId));
  if (!me || (me.role !== "farmer" && me.role !== "driver")) fail("Compte introuvable.");
  const [open] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.userId, userId), lt(ledgerEntries.createdAt, start)));
  const rows = await db
    .select({
      at: ledgerEntries.createdAt,
      kind: ledgerEntries.kind,
      amount: ledgerEntries.amount,
      note: ledgerEntries.note,
      orderRef: orders.reference,
      missionRef: missions.reference,
      payoutRef: payouts.reference,
      payoutProviderRef: payouts.providerRef,
    })
    .from(ledgerEntries)
    .leftJoin(orders, eq(orders.id, ledgerEntries.orderId))
    .leftJoin(missions, eq(missions.id, ledgerEntries.missionId))
    .leftJoin(payouts, eq(payouts.id, ledgerEntries.payoutId))
    .where(
      and(
        eq(ledgerEntries.userId, userId),
        gte(ledgerEntries.createdAt, start),
        lt(ledgerEntries.createdAt, end),
      ),
    )
    .orderBy(asc(ledgerEntries.createdAt));
  const opening = Number(open?.total ?? 0);
  const lines = rows.map((r) => {
    const ref =
      r.kind === "payout"
        ? `${r.payoutRef ?? ""}${r.payoutProviderRef ? ` · réf. ${r.payoutProviderRef}` : ""}`
        : (r.missionRef ?? r.orderRef ?? "");
    return {
      at: r.at.toISOString(),
      label: `${KIND_LABEL[r.kind] ?? "Écriture"}${r.note && r.kind !== "payout" ? ` (${r.note})` : ""}`,
      reference: ref.trim(),
      amount: r.amount,
    };
  });
  const credits = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const debits = lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
  return {
    month,
    account: {
      name: `${me.first} ${me.last}`.trim(),
      role: me.role,
      phone: me.phone ?? "",
    },
    seller: await seller(db),
    opening,
    lines,
    credits,
    debits,
    closing: opening + credits + debits,
    generatedAt: new Date().toISOString(),
  };
}
