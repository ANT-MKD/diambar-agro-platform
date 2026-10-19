import { issueCreditNote } from "./credit-notes-db.server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  disputeAttachments,
  disputeEvents,
  disputeMessages,
  disputes,
  files,
  ledgerEntries,
  missions,
  orders,
  refunds,
  users,
} from "@/db/schema";
import { formatFCFA } from "@/lib/format";
import {
  fail,
  hasPermission,
  nextNumber,
  notifyFinanceStaff,
  notifyOpsStaff,
  notifyUser,
  staffWithPermission,
  type Q,
  type Tx,
} from "./market-common.server";
import { readRules } from "./snapshot.server";

// Litiges en base. Une partie (restaurant, producteur, livreur) ouvre un
// dossier sur une commande ou une course, les parties et l'équipe échangent,
// puis l'équipe tranche. La décision a un effet réel : remboursement du
// restaurant (dossier Remboursement, payé comme les autres), ou indemnité au
// grand livre pour un producteur ou un livreur ; la partie responsable est
// débitée sur son solde (ou la plateforme prend en charge).

export type Party = "restaurant" | "farmer" | "driver" | "platform";
export type Outcome = "refund" | "partial" | "credit" | "goodwill" | "rejected";
type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };

/** Permission de l'équipe qui instruit et tranche les litiges. */
export const DISPUTE_PERMISSION = "disputes.decide" as const;

const SLA_HOURS = { high: 24, medium: 48, low: 72 } as const;
const PARTY_LABEL: Record<Party, string> = {
  restaurant: "Restaurant",
  farmer: "Producteur",
  driver: "Livreur",
  platform: "Plateforme",
};

export type StoredFile = { storageKey: string; mime: string; size: number; name: string };

export type OpenDisputeInput = {
  orderId?: string;
  missionId?: string;
  category: string;
  subcategory: string;
  description: string;
  againstRole: Party;
  claimedAmount: number;
  priority: "low" | "medium" | "high";
};

type Row = typeof disputes.$inferSelect;

async function addEvent(
  q: Q,
  disputeId: string,
  actorId: string | null,
  label: string,
  detail?: string,
) {
  await q.insert(disputeEvents).values({ disputeId, actorId, label, detail: detail ?? null });
}

async function attach(
  q: Q,
  disputeId: string,
  messageId: string,
  ownerId: string,
  list: StoredFile[],
) {
  for (const f of list) {
    const [file] = await q
      .insert(files)
      .values({ ownerId, storageKey: f.storageKey, mime: f.mime, sizeBytes: f.size })
      .returning({ id: files.id });
    await q.insert(disputeAttachments).values({
      disputeId,
      messageId,
      fileId: file.id,
      name: f.name.slice(0, 120) || "photo",
    });
  }
}

const portalOf = (role: Party) =>
  role === "restaurant"
    ? "restaurant"
    : role === "farmer"
      ? "farmer"
      : role === "driver"
        ? "driver"
        : null;

function isDisputeStaff(q: Q, userId: string): Promise<boolean> {
  return hasPermission(q, userId, DISPUTE_PERMISSION);
}

/** Ouvre un litige : seulement sur une commande (restaurant, producteur) ou
 * une course (livreur) qui concerne la personne. */
export async function openDispute(
  db: Db,
  me: Me,
  input: OpenDisputeInput,
  attachments: StoredFile[] = [],
  now = new Date(),
): Promise<{ id: string; reference: string }> {
  const opener: Exclude<Party, "platform"> =
    me.role === "admin" ? fail("L'équipe ne peut pas ouvrir de litige en son nom.") : me.role;
  const description = input.description.trim();
  if (description.length < 20) fail("Décrivez le problème (20 caractères minimum).");
  if (!(input.claimedAmount >= 0)) fail("Montant réclamé invalide.");
  if (input.againstRole === opener) fail("Choisissez une autre partie mise en cause.");

  return db.transaction(async (tx) => {
    // Commande et course concernées.
    let orderId = input.orderId ?? null;
    let missionId = input.missionId ?? null;
    if (me.role === "driver") {
      if (!missionId) fail("Choisissez la course concernée.");
      const [m] = await tx.select().from(missions).where(eq(missions.id, missionId));
      if (!m || m.driverId !== me.id) fail("Course introuvable.");
      orderId = m.orderId;
    }
    if (!orderId) fail("Choisissez la commande concernée.");
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o) fail("Commande introuvable.");
    if (me.role === "restaurant" && o.restaurantId !== me.id) fail("Commande introuvable.");
    if (me.role === "farmer" && o.farmerId !== me.id) fail("Commande introuvable.");
    if (!missionId) {
      const [m] = await tx
        .select({ id: missions.id })
        .from(missions)
        .where(and(eq(missions.orderId, o.id), notInArray(missions.status, ["cancelled"])));
      missionId = m?.id ?? null;
    }
    const [mission] = missionId
      ? await tx.select().from(missions).where(eq(missions.id, missionId))
      : [];

    // Restaurant : jamais plus que le montant de la commande, et un produit
    // abîmé ou manquant se signale dans le délai suivant la livraison.
    const orderTotal = o.subtotal + o.deliveryFee - o.discount;
    if (me.role === "restaurant") {
      if (input.claimedAmount > orderTotal) {
        fail(`Le montant réclamé ne peut dépasser ${formatFCFA(orderTotal)}.`);
      }
      const rules = await readRules(tx as unknown as Db);
      if (
        ["quality", "quantity"].includes(input.category) &&
        o.deliveredAt &&
        now.getTime() > o.deliveredAt.getTime() + rules.receptionWindowHours * 3600_000
      ) {
        fail(
          `Un produit abîmé ou manquant se signale dans les ${rules.receptionWindowHours} h suivant la livraison : contactez l'équipe.`,
        );
      }
    }

    const againstUserId =
      input.againstRole === "restaurant"
        ? o.restaurantId
        : input.againstRole === "farmer"
          ? o.farmerId
          : input.againstRole === "driver"
            ? (mission?.driverId ?? null)
            : null;
    if (input.againstRole === "driver" && !againstUserId) {
      fail("Aucun livreur n'a pris cette commande en charge.");
    }

    const [open] = await tx
      .select({ id: disputes.id, reference: disputes.reference })
      .from(disputes)
      .where(
        and(
          eq(disputes.orderId, o.id),
          eq(disputes.openedBy, me.id),
          notInArray(disputes.status, ["resolved", "rejected"]),
        ),
      );
    if (open)
      fail(`Le litige ${open.reference} est déjà ouvert pour cette commande : complétez-le.`);

    const reference = `LIT-${String(await nextNumber(tx, "dispute_reference_seq")).padStart(4, "0")}`;
    const [d] = await tx
      .insert(disputes)
      .values({
        reference,
        orderId: o.id,
        missionId,
        category: input.category.slice(0, 40),
        subcategory: input.subcategory.slice(0, 80),
        description,
        openedBy: me.id,
        openedByRole: opener,
        againstRole: input.againstRole,
        againstUserId,
        claimedAmount: Math.round(input.claimedAmount),
        priority: input.priority,
        slaDueAt: new Date(now.getTime() + SLA_HOURS[input.priority] * 3600_000),
      })
      .returning({ id: disputes.id });
    const [msg] = await tx
      .insert(disputeMessages)
      .values({ disputeId: d.id, authorId: me.id, authorRole: opener, text: description })
      .returning({ id: disputeMessages.id });
    await attach(tx, d.id, msg.id, me.id, attachments);
    await addEvent(
      tx,
      d.id,
      me.id,
      "Litige ouvert",
      `Délai de réponse ${SLA_HOURS[input.priority]} h`,
    );

    const portal = portalOf(input.againstRole);
    if (againstUserId && portal) {
      await notifyUser(tx, againstUserId, {
        type: "system",
        title: "Litige ouvert vous concernant",
        body: `${reference} sur ${o.reference} : ${input.subcategory}`,
        link: `/${portal}/disputes/${d.id}`,
      });
    }
    await notifyOpsStaff(
      tx,
      {
        type: "system",
        title: "Nouveau litige",
        body: `${reference} · ${PARTY_LABEL[opener]} contre ${PARTY_LABEL[input.againstRole]} · ${o.reference}`,
        link: `/admin/disputes/${d.id}`,
      },
      "disputes.decide",
    );
    return { id: d.id, reference };
  });
}

async function loadForParticipant(q: Q, me: Me, id: string): Promise<{ d: Row; staff: boolean }> {
  const [d] = await q.select().from(disputes).where(eq(disputes.id, id));
  if (!d) fail("Litige introuvable.");
  if (me.role === "admin") {
    if (!(await isDisputeStaff(q, me.id))) fail("Votre rôle ne permet pas de traiter les litiges.");
    return { d, staff: true };
  }
  if (d.openedBy !== me.id && d.againstUserId !== me.id) fail("Litige introuvable.");
  return { d, staff: false };
}

/** Message dans le dossier ; « interne » : note de l'équipe, jamais montrée aux parties. */
export async function replyDispute(
  db: Db,
  me: Me,
  id: string,
  input: { text: string; internal?: boolean },
  attachments: StoredFile[] = [],
) {
  const text = input.text.trim();
  if (!text) fail("Message vide.");
  await db.transaction(async (tx) => {
    const { d, staff } = await loadForParticipant(tx, me, id);
    if (d.status === "resolved" || d.status === "rejected") fail("Ce litige est clos.");
    const internal = staff && !!input.internal;
    const role: Party = staff ? "platform" : d.openedBy === me.id ? d.openedByRole : d.againstRole;
    const [msg] = await tx
      .insert(disputeMessages)
      .values({
        disputeId: d.id,
        authorId: me.id,
        authorRole: role,
        text: text.slice(0, 4000),
        internal,
      })
      .returning({ id: disputeMessages.id });
    await attach(tx, d.id, msg.id, me.id, attachments);
    // La partie mise en cause répond : le dossier repart en instruction.
    if (!staff && d.status === "awaiting_response" && d.againstUserId === me.id) {
      await tx
        .update(disputes)
        .set({ status: "investigating", updatedAt: new Date() })
        .where(eq(disputes.id, d.id));
    } else {
      await tx.update(disputes).set({ updatedAt: new Date() }).where(eq(disputes.id, d.id));
    }
    if (internal) return;
    const told = new Set<string>();
    for (const [userId, party] of [
      [d.openedBy, d.openedByRole],
      [d.againstUserId, d.againstRole],
    ] as const) {
      const portal = portalOf(party);
      if (!userId || userId === me.id || !portal || told.has(userId)) continue;
      told.add(userId);
      await notifyUser(tx, userId, {
        type: "system",
        title: `Nouveau message · ${d.reference}`,
        body: text.slice(0, 140),
        link: `/${portal}/disputes/${d.id}`,
      });
    }
    if (!staff) {
      await notifyOpsStaff(
        tx,
        {
          type: "system",
          title: `Nouveau message · ${d.reference}`,
          body: text.slice(0, 140),
          link: `/admin/disputes/${d.id}`,
        },
        "disputes.decide",
      );
    }
  });
}

async function loadForStaff(q: Q, adminId: string, id: string): Promise<Row> {
  if (!(await isDisputeStaff(q, adminId))) fail("Votre rôle ne permet pas de traiter les litiges.");
  const [d] = await q.select().from(disputes).where(eq(disputes.id, id));
  if (!d) fail("Litige introuvable.");
  if (d.status === "resolved" || d.status === "rejected") fail("Ce litige est clos.");
  return d;
}

/** Instruction : « en instruction » ou « réponse attendue » de la partie mise en cause. */
export async function setDisputeStatus(
  db: Db,
  adminId: string,
  id: string,
  status: "investigating" | "awaiting_response",
) {
  await db.transaction(async (tx) => {
    const d = await loadForStaff(tx, adminId, id);
    await tx.update(disputes).set({ status, updatedAt: new Date() }).where(eq(disputes.id, id));
    await addEvent(
      tx,
      id,
      adminId,
      status === "investigating" ? "Statut : En instruction" : "Statut : Réponse attendue",
      status === "awaiting_response" ? `Réponse demandée à la partie mise en cause` : undefined,
    );
    const portal = portalOf(d.againstRole);
    if (status === "awaiting_response" && d.againstUserId && portal) {
      await notifyUser(tx, d.againstUserId, {
        type: "system",
        title: `Votre réponse est attendue · ${d.reference}`,
        body: "L'équipe Diambar attend votre version des faits.",
        link: `/${portal}/disputes/${id}`,
      });
    }
  });
}

export async function assignDispute(db: Db, adminId: string, id: string, assigneeId: string) {
  await db.transaction(async (tx) => {
    await loadForStaff(tx, adminId, id);
    if (!(await isDisputeStaff(tx, assigneeId))) fail("Cette personne ne traite pas les litiges.");
    const [u] = await tx
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, assigneeId));
    await tx.update(disputes).set({ assigneeId, updatedAt: new Date() }).where(eq(disputes.id, id));
    await addEvent(
      tx,
      id,
      adminId,
      "Dossier assigné",
      `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim(),
    );
    if (assigneeId !== adminId) {
      await notifyUser(tx, assigneeId, {
        type: "system",
        title: "Litige assigné",
        body: "Un litige vous a été confié.",
        link: `/admin/disputes/${id}`,
      });
    }
  });
}

export async function escalateDispute(
  db: Db,
  adminId: string,
  id: string,
  reason: string,
  now = new Date(),
) {
  await db.transaction(async (tx) => {
    const d = await loadForStaff(tx, adminId, id);
    await tx
      .update(disputes)
      .set({
        escalations: d.escalations + 1,
        priority: "high",
        slaDueAt: new Date(now.getTime() + 12 * 3600_000),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, id));
    await addEvent(
      tx,
      id,
      adminId,
      `Escalade niveau ${d.escalations + 1}`,
      reason.trim() || undefined,
    );
  });
}

/** Une partie demande l'escalade (délai dépassé) : l'équipe est prévenue. */
export async function requestEscalation(db: Db, me: Me, id: string) {
  await db.transaction(async (tx) => {
    const { d } = await loadForParticipant(tx, me, id);
    if (d.status === "resolved" || d.status === "rejected") fail("Ce litige est clos.");
    await addEvent(tx, id, me.id, "Escalade demandée par une partie");
    await notifyOpsStaff(
      tx,
      {
        type: "system",
        title: `Escalade demandée · ${d.reference}`,
        body: "Une partie demande que le dossier soit traité en priorité.",
        link: `/admin/disputes/${id}`,
      },
      "disputes.decide",
    );
  });
}

async function ledger(
  tx: Tx,
  account: "farmer" | "driver" | "platform",
  userId: string | null,
  amount: number,
  note: string,
  link: { orderId: string | null; refundId?: string | null; missionId?: string | null },
) {
  if (amount === 0) return;
  await tx.insert(ledgerEntries).values({
    account,
    userId: account === "platform" ? null : userId,
    kind: account === "farmer" && link.refundId ? "refund_adjustment" : "adjustment",
    amount,
    orderId: link.orderId,
    refundId: link.refundId ?? null,
    missionId: link.missionId ?? null,
    note,
  });
}

/** Décision motivée et son effet financier réel. */
export async function resolveDispute(
  db: Db,
  adminId: string,
  id: string,
  input: { outcome: Outcome; grantedAmount: number; liableParty: Party; reason: string },
) {
  const reason = input.reason.trim();
  if (reason.length < 10) fail("Motivez la décision (10 caractères minimum).");
  return db.transaction(async (tx) => {
    const d = await loadForStaff(tx, adminId, id);
    const rejected = input.outcome === "rejected";
    const granted = rejected ? 0 : Math.round(input.grantedAmount);
    if (!rejected && !(granted > 0)) fail("Indiquez le montant accordé.");
    if (granted > d.claimedAmount)
      fail(`Pas plus que le montant réclamé (${formatFCFA(d.claimedAmount)}).`);
    // Un geste commercial est toujours à la charge de la plateforme.
    const liable: Party = input.outcome === "goodwill" ? "platform" : input.liableParty;
    if (!rejected && liable === "restaurant") {
      fail(
        "Un restaurant n'a pas de solde sur Diambar : choisissez le producteur, le livreur ou la plateforme.",
      );
    }
    if (!rejected && liable === d.openedByRole)
      fail("La partie indemnisée ne peut pas être celle qui paie.");
    if (input.outcome === "credit" && d.openedByRole !== "restaurant") {
      fail("Un avoir se déduit des commandes d'un restaurant : choisissez une autre issue.");
    }

    const [o] = d.orderId ? await tx.select().from(orders).where(eq(orders.id, d.orderId)) : [];
    const [m] = d.missionId
      ? await tx.select().from(missions).where(eq(missions.id, d.missionId))
      : [];
    const liableUser =
      liable === "farmer"
        ? (o?.farmerId ?? null)
        : liable === "driver"
          ? (m?.driverId ?? null)
          : null;
    if (!rejected && (liable === "farmer" || liable === "driver") && !liableUser) {
      fail(`Aucun ${liable === "farmer" ? "producteur" : "livreur"} lié à ce litige.`);
    }

    let refundId: string | null = null;
    if (granted > 0) {
      const note = `Litige ${d.reference}`;
      if (d.openedByRole === "restaurant" && input.outcome === "credit") {
        // Avoir : déduit des prochaines commandes du restaurant ; la partie
        // responsable le rend sur son solde dès maintenant.
        const credit = await issueCreditNote(tx, {
          restaurantId: d.openedBy,
          amount: granted,
          disputeId: d.id,
          bornBy: liable as "farmer" | "driver" | "platform",
          reason: `${note} — ${reason}`,
          createdBy: adminId,
        });
        await ledger(
          tx,
          liable as "farmer" | "driver" | "platform",
          liableUser,
          -granted,
          `Avoir ${credit.reference} · ${note}`,
          { orderId: o?.id ?? null, missionId: m?.id },
        );
      } else if (d.openedByRole === "restaurant") {
        // Remboursement du restaurant : un dossier Remboursement, payé comme les autres.
        if (!o) fail("Commande introuvable.");
        const reference = `REM-${await nextNumber(tx, "refund_reference_seq")}`;
        const [refund] = await tx
          .insert(refunds)
          .values({
            reference,
            orderId: o.id,
            source: "dispute",
            amount: granted,
            bornBy: liable as "farmer" | "driver" | "platform",
            status: "pending",
            reason: `${note} — ${reason}`.slice(0, 500),
          })
          .returning({ id: refunds.id });
        refundId = refund.id;
        await ledger(tx, liable as "farmer" | "driver" | "platform", liableUser, -granted, note, {
          orderId: o.id,
          refundId,
          missionId: m?.id,
        });
        await notifyFinanceStaff(
          tx,
          {
            type: "payment",
            title: "Remboursement à faire",
            body: `${reference} · ${formatFCFA(granted)} accordés (litige ${d.reference})`,
            link: "/admin/payments",
          },
          "refunds.execute",
        );
      } else {
        // Producteur ou livreur indemnisé sur son solde.
        const opener = d.openedByRole as "farmer" | "driver";
        await ledger(tx, opener, d.openedBy, granted, `Indemnité ${note}`, {
          orderId: d.orderId,
          missionId: m?.id,
        });
        await ledger(
          tx,
          liable as "farmer" | "driver" | "platform",
          liableUser,
          -granted,
          `Retenue ${note}`,
          {
            orderId: d.orderId,
            missionId: m?.id,
          },
        );
      }
    }

    const now = new Date();
    await tx
      .update(disputes)
      .set({
        status: rejected ? "rejected" : "resolved",
        outcome: input.outcome,
        grantedAmount: granted,
        liableParty: rejected ? null : liable,
        decisionReason: reason,
        decidedBy: adminId,
        decidedAt: now,
        refundId,
        updatedAt: now,
      })
      .where(eq(disputes.id, id));
    const label =
      input.outcome === "refund"
        ? "Remboursement intégral"
        : input.outcome === "partial"
          ? "Remboursement partiel"
          : input.outcome === "credit"
            ? "Avoir émis"
            : input.outcome === "goodwill"
              ? "Geste commercial"
              : "Réclamation rejetée";
    await addEvent(
      tx,
      id,
      adminId,
      `Décision : ${label}`,
      granted > 0 ? `${formatFCFA(granted)} · à la charge de ${PARTY_LABEL[liable]}` : undefined,
    );
    await tx.insert(disputeMessages).values({
      disputeId: id,
      authorId: adminId,
      authorRole: "platform",
      text: `Décision : ${label}. ${reason}`,
    });
    const body = `${d.reference} : ${label}${granted > 0 ? ` — ${formatFCFA(granted)}` : ""}`;
    for (const [userId, party] of [
      [d.openedBy, d.openedByRole],
      [d.againstUserId, d.againstRole],
    ] as const) {
      const portal = portalOf(party);
      if (!userId || !portal) continue;
      await notifyUser(tx, userId, {
        type: "system",
        title: "Décision sur le litige",
        body,
        link: `/${portal}/disputes/${id}`,
      });
    }
    return { refundId };
  });
}

/** Membres de l'équipe à qui confier un litige. */
export async function disputeStaff(q: Q): Promise<{ id: string; name: string }[]> {
  const ids = await staffWithPermission(q, DISPUTE_PERMISSION);
  if (ids.length === 0) return [];
  const rows = await q
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.id, ids));
  return rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}`.trim() || "Équipe" }));
}
