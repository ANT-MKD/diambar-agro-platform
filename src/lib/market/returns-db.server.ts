import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  checkouts,
  creditNotes,
  disputeEvents,
  disputeMessages,
  disputes,
  drivers,
  files,
  ledgerEntries,
  missions,
  orderItems,
  orders,
  refunds,
  returnEvents,
  returnMessages,
  returnPhotos,
  returnRequests,
  users,
} from "@/db/schema";
import type {
  ReturnInspection,
  ReturnPickup,
  ReturnReason,
  ReturnRequest,
  ReturnResolution,
  ReturnResolutionType,
} from "@/data/business";
import { formatFCFA } from "@/lib/format";
import { issueCreditNote } from "./credit-notes-db.server";
import type { StoredFile } from "./disputes-db.server";
import { photoUrl } from "./disputes-read.server";
import {
  audit,
  fail,
  nextNumber,
  notifyOpsStaff,
  notifyUser,
  requireStaffRole,
  staffRoleOf,
  type Q,
  type Tx,
} from "./market-common.server";
import { loadPeople } from "./people.server";
import { cancelRefund, createRefund, type Liable } from "./refunds-db.server";
import { readRules } from "./snapshot.server";

// Retours produit en base. Le restaurant déclare, dans le délai de réception,
// un produit livré non conforme. Le producteur accepte (remboursement à sa
// charge, payé par la finance comme les autres) ou refuse, et peut remplacer
// le remboursement par un avoir. L'équipe organise la récupération, inspecte,
// tranche qui paie, escalade en litige ou clôture.

type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };
type Row = typeof returnRequests.$inferSelect;

/** Équipe qui traite les retours (comme les litiges). */
export const RETURN_STAFF = ["super_admin", "operations", "support"] as const;

const REASON_LABEL: Record<ReturnReason, string> = {
  quality: "Qualité non conforme",
  quantity: "Quantité manquante",
  wrong_item: "Produit erroné",
  damaged: "Marchandise abîmée",
  late: "Livraison trop tardive",
  other: "Autre motif",
};
const RESOLUTION_LABEL: Record<ReturnResolutionType, string> = {
  refund: "Remboursement",
  exchange: "Échange produit",
  goodwill: "Geste commercial",
  reject: "Refus",
};
const PARTY_LABEL: Record<Liable, string> = {
  farmer: "producteur",
  driver: "livreur",
  platform: "plateforme",
};

async function event(q: Q, returnId: string, actorId: string | null, text: string) {
  await q.insert(returnEvents).values({ returnId, actorId, text: text.slice(0, 500) });
}

async function attach(q: Q, returnId: string, ownerId: string, list: StoredFile[]) {
  for (const f of list) {
    const [file] = await q
      .insert(files)
      .values({ ownerId, storageKey: f.storageKey, mime: f.mime, sizeBytes: f.size })
      .returning({ id: files.id });
    await q.insert(returnPhotos).values({
      returnId,
      fileId: file.id,
      name: f.name.slice(0, 120) || "photo",
      uploadedBy: ownerId,
    });
  }
}

export type CreateReturnInput = {
  orderId: string;
  productId: string;
  qty: number;
  reason: ReturnReason;
  description: string;
  requestedAmount: number;
};

export async function createReturn(
  db: Db,
  me: Me,
  input: CreateReturnInput,
  photos: StoredFile[] = [],
  now = new Date(),
): Promise<{ id: string; reference: string }> {
  if (me.role !== "restaurant") fail("Seul le restaurant déclare un retour.");
  const description = input.description.trim();
  if (description.length < 10) fail("Décrivez le problème (10 caractères minimum).");
  const amount = Math.round(input.requestedAmount);
  if (!(amount > 0)) fail("Indiquez un montant.");
  if (!(input.qty > 0)) fail("Indiquez la quantité concernée.");
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
    if (!o || o.restaurantId !== me.id) fail("Commande introuvable.");
    if (o.status !== "delivered" || !o.deliveredAt) {
      fail("Seules les commandes livrées peuvent faire l'objet d'un retour.");
    }
    const rules = await readRules(tx as unknown as Db);
    if (now.getTime() > o.deliveredAt.getTime() + rules.receptionWindowHours * 3600_000) {
      fail(
        `Le délai de réclamation de ${rules.receptionWindowHours} h après la livraison est dépassé : contactez le support.`,
      );
    }
    const [line] = await tx
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.orderId, o.id), eq(orderItems.productId, input.productId)));
    if (!line) fail("Ce produit ne fait pas partie de la commande.");
    const delivered = (line.qtyConfirmed ?? line.qtyOrdered) - line.qtyRefused;
    if (input.qty > delivered) fail(`Au plus ${delivered} ${line.unit} livrés sur cette ligne.`);
    const lineValue = Math.round(delivered * line.unitPrice);
    if (amount > lineValue) {
      fail(`Le montant ne peut pas dépasser la valeur de la ligne (${formatFCFA(lineValue)}).`);
    }
    const [open] = await tx
      .select({ reference: returnRequests.reference })
      .from(returnRequests)
      .where(and(eq(returnRequests.orderItemId, line.id), ne(returnRequests.status, "refused")));
    if (open) fail(`Un retour existe déjà pour ce produit sur cette commande (${open.reference}).`);

    const reference = `RET-${String(await nextNumber(tx, "return_reference_seq")).padStart(4, "0")}`;
    const [r] = await tx
      .insert(returnRequests)
      .values({
        reference,
        orderId: o.id,
        orderItemId: line.id,
        restaurantId: me.id,
        farmerId: o.farmerId,
        qty: input.qty,
        reason: input.reason,
        description: description.slice(0, 2000),
        requestedAmount: amount,
      })
      .returning({ id: returnRequests.id });
    await attach(tx, r.id, me.id, photos);
    await event(tx, r.id, me.id, "Demande de retour ouverte");
    const people = await loadPeople(tx, [me.id]);
    await notifyUser(tx, o.farmerId, {
      type: "order",
      title: "Demande de retour",
      body: `${people.get(me.id)?.name ?? "Un restaurant"} : ${input.qty} ${line.unit} de ${line.productName} (${reference}) — réponse attendue`,
      link: `/farmer/returns/${r.id}`,
    });
    return { id: r.id, reference };
  });
}

/** Le retour, s'il concerne la personne (ou si elle est de l'équipe retours). */
async function loadFor(
  q: Q,
  me: Me,
  id: string,
  lock = false,
): Promise<{ r: Row; staff: boolean }> {
  const base = q.select().from(returnRequests).where(eq(returnRequests.id, id));
  const [r] = lock ? await base.for("update") : await base;
  if (!r) fail("Retour introuvable.");
  if (me.role === "admin") {
    await requireStaffRole(
      q,
      me.id,
      RETURN_STAFF,
      "Votre rôle ne permet pas de traiter les retours.",
    );
    return { r, staff: true };
  }
  if (r.restaurantId !== me.id && r.farmerId !== me.id) fail("Retour introuvable.");
  return { r, staff: false };
}

export async function replyReturn(
  db: Db,
  me: Me,
  id: string,
  text: string,
  photos: StoredFile[] = [],
) {
  const body = text.trim().slice(0, 2000);
  if (!body && !photos.length) fail("Message vide.");
  return db.transaction(async (tx) => {
    const { r, staff } = await loadFor(tx, me, id);
    if (r.closedAt && !staff) fail("Ce dossier est clôturé.");
    if (body) {
      await tx.insert(returnMessages).values({
        returnId: r.id,
        authorId: me.id,
        authorRole: staff ? "platform" : me.role === "farmer" ? "farmer" : "restaurant",
        text: body,
      });
    }
    if (photos.length) {
      await attach(tx, r.id, me.id, photos);
      await event(tx, r.id, me.id, `${photos.length} document(s) ajouté(s)`);
    }
    const targets: [string, "restaurant" | "farmer"][] = [];
    if (me.id !== r.restaurantId) targets.push([r.restaurantId, "restaurant"]);
    if (me.id !== r.farmerId) targets.push([r.farmerId, "farmer"]);
    for (const [userId, portal] of targets) {
      await notifyUser(tx, userId, {
        type: "system",
        title: `Retour ${r.reference}`,
        body: body ? body.slice(0, 140) : "Nouveaux documents joints",
        link: `/${portal}/returns/${r.id}`,
      });
    }
  });
}

async function orderOf(tx: Tx, r: Row) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, r.orderId));
  return o;
}

/** Livreur de la course livrée (si l'équipe met le retour à sa charge). */
async function deliveredDriver(tx: Tx, orderId: string) {
  const [m] = await tx
    .select({ id: missions.id, driverId: missions.driverId })
    .from(missions)
    .where(and(eq(missions.orderId, orderId), eq(missions.status, "delivered")));
  return m ?? null;
}

/** Décision du producteur : accepter (montant accordé) ou refuser (motif). */
export async function farmerDecideReturn(
  db: Db,
  me: Me,
  id: string,
  input: { accept: boolean; amount?: number; note?: string },
) {
  if (me.role !== "farmer") fail("Seul le producteur décide ici.");
  const note = input.note?.trim().slice(0, 500) ?? "";
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.status !== "pending" || r.resolution || r.disputeId) fail("Ce retour a déjà été traité.");
    const o = await orderOf(tx, r);
    if (!input.accept) {
      if (note.length < 3) fail("Indiquez le motif du refus.");
      await tx
        .update(returnRequests)
        .set({
          status: "refused",
          decisionNote: note,
          decidedBy: me.id,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(returnRequests.id, r.id));
      await event(tx, r.id, me.id, `Retour refusé — ${note}`);
      await notifyUser(tx, r.restaurantId, {
        type: "order",
        title: "Retour refusé",
        body: `${r.reference} : ${note}`,
        link: `/restaurant/returns/${r.id}`,
      });
      await notifyOpsStaff(tx, {
        type: "system",
        title: "Retour refusé par le producteur",
        body: `${r.reference} sur ${o.reference} : ${note.slice(0, 100)}`,
        link: `/admin/returns/${r.id}`,
      });
      return;
    }
    const awarded = Math.round(input.amount ?? r.requestedAmount);
    if (!(awarded > 0)) fail("Indiquez le montant accordé.");
    if (awarded > r.requestedAmount) {
      fail(`Pas plus que le montant réclamé (${formatFCFA(r.requestedAmount)}).`);
    }
    const refund = await createRefund(tx, {
      orderId: r.orderId,
      source: "return",
      amount: awarded,
      bornBy: "farmer",
      liableUserId: r.farmerId,
      reason: `Retour ${r.reference} — ${REASON_LABEL[r.reason]}`,
      createdBy: null,
      label: `Retour ${r.reference}`,
    });
    await tx
      .update(returnRequests)
      .set({
        status: "accepted",
        awardedAmount: awarded,
        decisionNote: note || null,
        decidedBy: me.id,
        decidedAt: new Date(),
        refundId: refund.id,
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, r.id));
    await event(
      tx,
      r.id,
      me.id,
      `Retour accepté — ${formatFCFA(awarded)} (remboursement ${refund.reference})`,
    );
    await notifyUser(tx, r.restaurantId, {
      type: "order",
      title: "Retour accepté",
      body: `${r.reference} : ${formatFCFA(awarded)} accordés par le producteur`,
      link: `/restaurant/returns/${r.id}`,
    });
  });
}

/** Remplace le remboursement prévu par un avoir (producteur ou équipe). */
export async function creditReturn(db: Db, me: Me, id: string) {
  return db.transaction(async (tx) => {
    const { r, staff } = await loadFor(tx, me, id, true);
    if (!staff && me.id !== r.farmerId) fail("Seul le producteur ou l'équipe émet l'avoir.");
    if (r.status === "credited") fail("Un avoir a déjà été émis.");
    if (r.status !== "accepted") fail("Le retour doit d'abord être accepté.");
    if (r.disputeId) fail("Ce retour est traité dans un litige.");
    if (r.closedAt) fail("Ce dossier est clôturé.");
    const resolution = r.resolution as ReturnResolution | null;
    if (resolution?.type === "exchange") fail("Ce retour est réglé par un échange de produit.");
    const amount = r.awardedAmount ?? r.requestedAmount;
    let bornBy: Liable = resolution?.bornBy ?? "farmer";
    if (r.refundId) {
      const [ref] = await tx.select().from(refunds).where(eq(refunds.id, r.refundId));
      if (ref) bornBy = ref.bornBy;
      if (!(await cancelRefund(tx, r.refundId, "remplacé par un avoir"))) {
        fail("Le restaurant a déjà été remboursé : pas d'avoir en plus.");
      }
    }
    let liableUser: string | null = null;
    let missionId: string | null = null;
    if (bornBy === "farmer") liableUser = r.farmerId;
    if (bornBy === "driver") {
      const m = await deliveredDriver(tx, r.orderId);
      liableUser = m?.driverId ?? null;
      missionId = m?.id ?? null;
      if (!liableUser) bornBy = "platform";
    }
    const credit = await issueCreditNote(tx, {
      restaurantId: r.restaurantId,
      amount,
      disputeId: null,
      bornBy,
      reason: `Retour ${r.reference}`,
      createdBy: me.id,
    });
    await tx.insert(ledgerEntries).values({
      account: bornBy,
      userId: bornBy === "platform" ? null : liableUser,
      kind: "adjustment",
      amount: -amount,
      orderId: r.orderId,
      missionId,
      note: `Avoir ${credit.reference} · retour ${r.reference}`,
    });
    await tx
      .update(returnRequests)
      .set({ status: "credited", creditNoteId: credit.id, updatedAt: new Date() })
      .where(eq(returnRequests.id, r.id));
    await event(
      tx,
      r.id,
      me.id,
      `Avoir ${credit.reference} émis au restaurant (${formatFCFA(amount)})`,
    );
  });
}

// --- Équipe ------------------------------------------------------------------------

async function staffName(q: Q, id: string) {
  return (await loadPeople(q, [id])).get(id)?.name ?? "Équipe Diambar";
}

export async function scheduleReturnPickup(
  db: Db,
  me: Me,
  id: string,
  input: { driverId: string; scheduledFor: string; address: string },
) {
  const when = new Date(input.scheduledFor);
  if (Number.isNaN(when.getTime())) fail("Créneau invalide.");
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.closedAt || r.status === "refused") fail("Ce retour n'attend pas de récupération.");
    const [d] = await tx
      .select({ id: drivers.userId, first: users.firstName, last: users.lastName })
      .from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(and(eq(drivers.userId, input.driverId), eq(users.status, "active")));
    if (!d) fail("Livreur introuvable ou inactif.");
    const [c] = await tx
      .select({ address: checkouts.deliveryAddress })
      .from(orders)
      .innerJoin(checkouts, eq(checkouts.id, orders.checkoutId))
      .where(eq(orders.id, r.orderId));
    const address = input.address.trim().slice(0, 300) || c?.address || "Adresse du restaurant";
    const driverName = `${d.first} ${d.last}`.trim();
    const pickup: ReturnPickup = {
      driverId: d.id,
      driverName,
      scheduledFor: when.toISOString(),
      address,
      status: "scheduled",
      scheduledAt: new Date().toISOString(),
    };
    await tx
      .update(returnRequests)
      .set({ pickup, updatedAt: new Date() })
      .where(eq(returnRequests.id, r.id));
    await event(
      tx,
      r.id,
      me.id,
      `Récupération programmée — ${driverName}, ${when.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar" })}`,
    );
    await notifyUser(tx, d.id, {
      type: "system",
      title: "Récupération d'un retour",
      body: `${r.reference} : ${address}, ${when.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dakar" })}`,
      link: "/driver",
    });
  });
}

export async function advanceReturnPickup(
  db: Db,
  me: Me,
  id: string,
  step: "picked_up" | "received",
  condition = "",
) {
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    const p = r.pickup as ReturnPickup | null;
    if (!p) fail("Aucune récupération programmée.");
    const at = new Date().toISOString();
    if (step === "picked_up") {
      if (p.status !== "scheduled") fail("Le produit a déjà été récupéré.");
      await tx
        .update(returnRequests)
        .set({ pickup: { ...p, status: "picked_up", pickedUpAt: at }, updatedAt: new Date() })
        .where(eq(returnRequests.id, r.id));
      await event(tx, r.id, me.id, `Produit récupéré chez le client (${p.driverName})`);
      return;
    }
    const state = condition.trim().slice(0, 300);
    if (!state) fail("Indiquez l'état constaté à la réception.");
    if (p.status === "received") fail("Le produit a déjà été réceptionné.");
    await tx
      .update(returnRequests)
      .set({
        pickup: {
          ...p,
          status: "received",
          pickedUpAt: p.pickedUpAt ?? at,
          receivedAt: at,
          receivedCondition: state,
        },
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, r.id));
    await event(tx, r.id, me.id, `Produit réceptionné — état : ${state}`);
  });
}

export async function inspectReturn(
  db: Db,
  me: Me,
  id: string,
  input: { conform: boolean; note: string },
) {
  const note = input.note.trim().slice(0, 500);
  if (!note) fail("Indiquez une note d'inspection.");
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.closedAt) fail("Ce dossier est clôturé.");
    const inspection: ReturnInspection = {
      conform: input.conform,
      note,
      inspectedBy: await staffName(tx, me.id),
      inspectedAt: new Date().toISOString(),
    };
    await tx
      .update(returnRequests)
      .set({ inspection, updatedAt: new Date() })
      .where(eq(returnRequests.id, r.id));
    await event(
      tx,
      r.id,
      me.id,
      `Inspection : ${input.conform ? "conforme au signalement" : "non conforme au signalement"} — ${note}`,
    );
  });
}

/** Décision motivée de l'équipe : qui paie, et sous quelle forme. */
export async function resolveReturn(
  db: Db,
  me: Me,
  id: string,
  input: { type: ReturnResolutionType; bornBy: Liable; amount?: number; note: string },
) {
  const note = input.note.trim().slice(0, 500);
  if (note.length < 5) fail("Une justification est obligatoire.");
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.closedAt) fail("Ce dossier est clôturé.");
    if (r.status === "refused") fail("Ce retour a été refusé.");
    if (r.status === "credited") fail("Un avoir a déjà indemnisé ce retour.");
    if (r.disputeId) fail("Ce retour est traité dans un litige.");
    const amount = Math.round(
      Math.min(input.amount ?? r.awardedAmount ?? r.requestedAmount, r.requestedAmount),
    );
    // Un geste commercial est toujours à la charge de la plateforme.
    let bornBy: Liable = input.type === "goodwill" ? "platform" : input.bornBy;
    const decidedBy = await staffName(tx, me.id);
    const resolution: ReturnResolution = {
      type: input.type,
      bornBy,
      note,
      decidedBy,
      decidedAt: new Date().toISOString(),
    };
    // Le remboursement déjà prévu (producteur) est remplacé par la décision.
    if (r.refundId) {
      if (!(await cancelRefund(tx, r.refundId, "remplacé par la décision de l'équipe"))) {
        fail("Le restaurant a déjà été remboursé : la décision ne peut plus changer.");
      }
    }
    let refundId: string | null = null;
    let label = `${RESOLUTION_LABEL[input.type]}`;
    if (input.type === "refund" || input.type === "goodwill") {
      if (!(amount > 0)) fail("Indiquez le montant.");
      let liableUserId: string | null = null;
      let missionId: string | null = null;
      if (bornBy === "farmer") liableUserId = r.farmerId;
      if (bornBy === "driver") {
        const m = await deliveredDriver(tx, r.orderId);
        if (!m?.driverId) fail("Aucun livreur n'a livré cette commande.");
        liableUserId = m.driverId;
        missionId = m.id;
      }
      const refund = await createRefund(tx, {
        orderId: r.orderId,
        source: "return",
        amount,
        bornBy,
        liableUserId,
        missionId,
        reason: `Retour ${r.reference} — décision de l'équipe (${note})`,
        createdBy: me.id,
        label: `Retour ${r.reference}`,
      });
      refundId = refund.id;
      label += ` (${formatFCFA(amount)}, à la charge du ${PARTY_LABEL[bornBy]})`;
    } else {
      bornBy = input.bornBy;
    }
    const rejected = input.type === "reject";
    await tx
      .update(returnRequests)
      .set({
        status: rejected ? "refused" : "accepted",
        awardedAmount: rejected || input.type === "exchange" ? r.awardedAmount : amount,
        decisionNote: note,
        decidedBy: me.id,
        decidedAt: new Date(),
        resolution,
        refundId,
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, r.id));
    await event(tx, r.id, me.id, `Décision de l'équipe — ${label} : ${note}`);
    for (const [userId, portal] of [
      [r.restaurantId, "restaurant"],
      [r.farmerId, "farmer"],
    ] as const) {
      await notifyUser(tx, userId, {
        type: "order",
        title: "Décision sur le retour",
        body: `${r.reference} : ${label}`,
        link: `/${portal}/returns/${r.id}`,
      });
    }
    await audit(tx, {
      module: "returns",
      actorId: me.id,
      action: `Décision retour : ${RESOLUTION_LABEL[input.type]}`,
      targetType: "return",
      targetId: r.id,
      after: { type: input.type, bornBy, amount, note },
    });
  });
}

/** Escalade en litige : le litige décidera de l'indemnisation. */
export async function escalateReturn(db: Db, me: Me, id: string, note: string, now = new Date()) {
  const why = note.trim().slice(0, 500);
  if (why.length < 5) fail("Indiquez le motif de l'escalade.");
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.disputeId) fail("Ce retour est déjà en litige.");
    if (r.closedAt) fail("Ce dossier est clôturé.");
    if (r.status === "credited") fail("Un avoir a déjà indemnisé ce retour.");
    if (r.refundId && !(await cancelRefund(tx, r.refundId, "retour escaladé en litige"))) {
      fail("Le restaurant a déjà été remboursé : pas de litige en plus.");
    }
    const o = await orderOf(tx, r);
    const [m] = await tx
      .select({ id: missions.id })
      .from(missions)
      .where(and(eq(missions.orderId, o.id), ne(missions.status, "cancelled")));
    const reference = `LIT-${String(await nextNumber(tx, "dispute_reference_seq")).padStart(4, "0")}`;
    const description = `Retour ${r.reference} escaladé en litige — ${why}\n\n${r.description}`;
    const [d] = await tx
      .insert(disputes)
      .values({
        reference,
        orderId: o.id,
        missionId: m?.id ?? null,
        category: "quality",
        subcategory: "Retour litigieux",
        description,
        openedBy: r.restaurantId,
        openedByRole: "restaurant",
        againstRole: "farmer",
        againstUserId: r.farmerId,
        claimedAmount: r.requestedAmount,
        priority: "medium",
        slaDueAt: new Date(now.getTime() + 48 * 3600_000),
      })
      .returning({ id: disputes.id });
    await tx.insert(disputeMessages).values({
      disputeId: d.id,
      authorId: me.id,
      authorRole: "platform",
      text: description,
    });
    await tx.insert(disputeEvents).values({
      disputeId: d.id,
      actorId: me.id,
      label: "Litige ouvert depuis un retour",
      detail: r.reference,
    });
    await tx
      .update(returnRequests)
      .set({ disputeId: d.id, refundId: null, updatedAt: new Date() })
      .where(eq(returnRequests.id, r.id));
    await event(tx, r.id, me.id, `Escaladé en litige ${reference} — ${why}`);
    for (const [userId, portal] of [
      [r.restaurantId, "restaurant"],
      [r.farmerId, "farmer"],
    ] as const) {
      await notifyUser(tx, userId, {
        type: "system",
        title: "Retour escaladé en litige",
        body: `${r.reference} → ${reference}`,
        link: `/${portal}/disputes/${d.id}`,
      });
    }
    return { disputeId: d.id };
  });
}

export async function closeReturn(db: Db, me: Me, id: string) {
  return db.transaction(async (tx) => {
    const { r } = await loadFor(tx, me, id, true);
    if (r.closedAt) return;
    await tx
      .update(returnRequests)
      .set({ closedAt: new Date(), updatedAt: new Date() })
      .where(eq(returnRequests.id, r.id));
    await event(tx, r.id, me.id, "Dossier clôturé");
  });
}

// --- Lecture -----------------------------------------------------------------------

export async function readReturns(q: Q, me: Me): Promise<ReturnRequest[]> {
  if (me.role === "driver") return [];
  if (me.role === "admin") {
    const role = await staffRoleOf(q, me.id);
    if (!role || !(RETURN_STAFF as readonly string[]).includes(role)) return [];
  }
  const rows = await q
    .select({
      r: returnRequests,
      orderRef: orders.reference,
      productId: orderItems.productId,
      productName: orderItems.productName,
      unit: orderItems.unit,
    })
    .from(returnRequests)
    .innerJoin(orders, eq(orders.id, returnRequests.orderId))
    .innerJoin(orderItems, eq(orderItems.id, returnRequests.orderItemId))
    .where(
      me.role === "admin"
        ? undefined
        : or(eq(returnRequests.restaurantId, me.id), eq(returnRequests.farmerId, me.id)),
    )
    .orderBy(desc(returnRequests.createdAt))
    .limit(500);
  if (!rows.length) return [];
  const ids = rows.map((x) => x.r.id);
  const refundIds = rows.flatMap((x) => (x.r.refundId ? [x.r.refundId] : []));
  const creditIds = rows.flatMap((x) => (x.r.creditNoteId ? [x.r.creditNoteId] : []));
  const [messages, events, photos, refundRows, creditRows] = await Promise.all([
    q
      .select()
      .from(returnMessages)
      .where(inArray(returnMessages.returnId, ids))
      .orderBy(asc(returnMessages.createdAt)),
    q
      .select()
      .from(returnEvents)
      .where(inArray(returnEvents.returnId, ids))
      .orderBy(asc(returnEvents.createdAt)),
    q
      .select({
        id: returnPhotos.id,
        returnId: returnPhotos.returnId,
        name: returnPhotos.name,
        uploadedBy: returnPhotos.uploadedBy,
        createdAt: returnPhotos.createdAt,
        key: files.storageKey,
        mime: files.mime,
        size: files.sizeBytes,
      })
      .from(returnPhotos)
      .innerJoin(files, eq(files.id, returnPhotos.fileId))
      .where(inArray(returnPhotos.returnId, ids))
      .orderBy(asc(returnPhotos.createdAt)),
    refundIds.length
      ? q.select().from(refunds).where(inArray(refunds.id, refundIds))
      : Promise.resolve([]),
    creditIds.length
      ? q
          .select({ id: creditNotes.id, reference: creditNotes.reference })
          .from(creditNotes)
          .where(inArray(creditNotes.id, creditIds))
      : Promise.resolve([]),
  ]);
  const people = await loadPeople(q, [
    ...rows.flatMap((x) => [x.r.restaurantId, x.r.farmerId]),
    ...messages.map((m) => m.authorId),
    ...events.map((e) => e.actorId),
    ...photos.map((p) => p.uploadedBy),
  ]);
  const urls = new Map<string, string | undefined>();
  await Promise.all(photos.map(async (p) => urls.set(p.id, await photoUrl(p.key))));
  const nameOf = (id: string | null, fallback = "Équipe Diambar") =>
    (id && people.get(id)?.name) || fallback;

  return rows.map(({ r, orderRef, productId, productName, unit }) => {
    const refund = refundRows.find((x) => x.id === r.refundId);
    const credit = creditRows.find((x) => x.id === r.creditNoteId);
    return {
      id: r.id,
      reference: r.reference,
      orderRef,
      orderId: r.orderId,
      restaurantId: r.restaurantId,
      restaurantName: nameOf(r.restaurantId, "Restaurant"),
      farmerId: r.farmerId,
      farmerName: nameOf(r.farmerId, "Producteur"),
      productId,
      productName,
      qty: r.qty,
      unit,
      reason: r.reason,
      description: r.description,
      requestedAmount: r.requestedAmount,
      awardedAmount: r.awardedAmount ?? undefined,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString(),
      decisionNote: r.decisionNote ?? undefined,
      creditNoteRef: credit?.reference,
      photos: photos
        .filter((p) => p.returnId === r.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          size: p.size,
          mime: p.mime,
          kind: "photo" as const,
          dataUrl: urls.get(p.id),
          by: nameOf(p.uploadedBy),
          at: p.createdAt.toISOString(),
        })),
      messages: messages
        .filter((m) => m.returnId === r.id)
        .map((m) => ({
          id: m.id,
          at: m.createdAt.toISOString(),
          authorRole: m.authorRole === "farmer" ? ("farmer" as const) : ("restaurant" as const),
          fromTeam: m.authorRole === "platform" || undefined,
          authorName: m.authorRole === "platform" ? "Équipe Diambar" : nameOf(m.authorId),
          text: m.text,
        })),
      history: events
        .filter((e) => e.returnId === r.id)
        .map((e) => ({ at: e.createdAt.toISOString(), actor: nameOf(e.actorId), text: e.text })),
      pickup: (r.pickup as ReturnPickup | null) ?? undefined,
      inspection: (r.inspection as ReturnInspection | null) ?? undefined,
      resolution: (r.resolution as ReturnResolution | null) ?? undefined,
      escalatedDisputeId: r.disputeId ?? undefined,
      closedAt: r.closedAt?.toISOString(),
      refund: refund
        ? {
            id: refund.id,
            reference: refund.reference,
            status: refund.status,
            amount: refund.amount,
          }
        : undefined,
    } satisfies ReturnRequest;
  });
}
