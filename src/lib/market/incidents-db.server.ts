import { and, asc, desc, eq, inArray, ne, sum } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  files,
  incidentEvents,
  incidentPhotos,
  incidents,
  ledgerEntries,
  missions,
  orders,
  refunds,
} from "@/db/schema";
import type { Incident, IncidentSeverity, IncidentType } from "@/data/business";
import { formatFCFA } from "@/lib/format";
import type { StoredFile } from "./disputes-db.server";
import { photoUrl } from "./disputes-read.server";
import {
  audit,
  fail,
  nextNumber,
  notifyOpsStaff,
  notifyUser,
  hasPermission,
  requirePermission,
  type Q,
} from "./market-common.server";
import { loadPeople } from "./people.server";
import { createRefund } from "./refunds-db.server";

// Incidents de course : le livreur signale ce qui a gêné une de ses courses et
// peut demander une indemnité (attente, panne…). L'équipe la verse sur son
// solde (grand livre, à la charge de la plateforme) ou la refuse.

type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };

/** Permission de l'équipe qui traite les incidents. */
export const INCIDENT_PERMISSION = "incidents.decide" as const;

// Gravité fixée par le type, comme à l'écran.
const SEVERITY: Record<IncidentType, IncidentSeverity> = {
  accident: "critical",
  breakdown: "high",
  client_absent: "medium",
  refused: "medium",
  address: "low",
  traffic: "low",
  other: "medium",
};
const TYPE_LABEL: Record<IncidentType, string> = {
  client_absent: "Client absent",
  refused: "Colis refusé",
  breakdown: "Panne véhicule",
  accident: "Accident / dommage",
  traffic: "Blocage circulation",
  address: "Adresse introuvable",
  other: "Autre",
};

async function event(q: Q, incidentId: string, actorId: string | null, text: string) {
  await q.insert(incidentEvents).values({ incidentId, actorId, text: text.slice(0, 1000) });
}

export type CreateIncidentInput = {
  missionId: string;
  type: IncidentType;
  description: string;
  waitedMinutes: number;
  compensationRequested: number;
};

export async function createIncident(
  db: Db,
  me: Me,
  input: CreateIncidentInput,
  photos: StoredFile[] = [],
): Promise<{ id: string; reference: string }> {
  if (me.role !== "driver" && me.role !== "admin") {
    fail("Seul le livreur (ou l'équipe) signale un incident de course.");
  }
  const description = input.description.trim();
  if (description.length < 5) fail("Décrivez l'incident.");
  const waited = Math.max(0, Math.round(input.waitedMinutes || 0));
  const asked = Math.max(0, Math.round(input.compensationRequested || 0));
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(missions).where(eq(missions.id, input.missionId));
    if (me.role === "admin") {
      await requirePermission(
        tx,
        me.id,
        INCIDENT_PERMISSION,
        "Votre rôle ne permet pas de traiter les incidents.",
      );
      if (!m) fail("Course introuvable.");
      if (!m.driverId) fail("Aucun livreur n'a pris cette course.");
    } else if (!m || m.driverId !== me.id) {
      fail("Course introuvable.");
    }
    const driverId = m.driverId!;
    const reference = `INC-${String(await nextNumber(tx, "incident_reference_seq")).padStart(4, "0")}`;
    const severity = SEVERITY[input.type];
    const [inc] = await tx
      .insert(incidents)
      .values({
        reference,
        missionId: m.id,
        driverId,
        type: input.type,
        severity,
        description: description.slice(0, 2000),
        waitedMinutes: waited,
        compensationRequested: asked,
      })
      .returning({ id: incidents.id });
    for (const f of photos) {
      const [file] = await tx
        .insert(files)
        .values({ ownerId: me.id, storageKey: f.storageKey, mime: f.mime, sizeBytes: f.size })
        .returning({ id: files.id });
      await tx.insert(incidentPhotos).values({
        incidentId: inc.id,
        fileId: file.id,
        name: f.name.slice(0, 120) || "photo",
      });
    }
    await event(
      tx,
      inc.id,
      me.id,
      me.role === "admin" ? "Incident ouvert par l'équipe" : "Incident signalé",
    );
    if (me.role === "admin") {
      await notifyUser(tx, driverId, {
        type: "system",
        title: "Incident ouvert sur votre course",
        body: `${reference} · ${m.reference} · ${TYPE_LABEL[input.type]}`,
        link: `/driver/incidents/${inc.id}`,
      });
    }
    await notifyOpsStaff(
      tx,
      {
        type: "system",
        title: severity === "critical" ? "Incident critique" : "Incident de course",
        body: `${reference} · ${m.reference} · ${TYPE_LABEL[input.type]}`,
        link: `/admin/incidents/${inc.id}`,
      },
      "incidents.decide",
    );
    return { id: inc.id, reference };
  });
}

async function loadFor(q: Q, me: Me, id: string) {
  const [i] = await q.select().from(incidents).where(eq(incidents.id, id));
  if (!i) fail("Incident introuvable.");
  if (me.role === "admin") {
    await requirePermission(
      q,
      me.id,
      INCIDENT_PERMISSION,
      "Votre rôle ne permet pas de traiter les incidents.",
    );
    return { i, staff: true };
  }
  if (i.driverId !== me.id) fail("Incident introuvable.");
  return { i, staff: false };
}

/** Le livreur escalade au support (réponse attendue en priorité). */
export async function escalateIncident(db: Db, me: Me, id: string) {
  return db.transaction(async (tx) => {
    const { i } = await loadFor(tx, me, id);
    if (i.status !== "open") fail("Cet incident n'est plus ouvert.");
    await tx
      .update(incidents)
      .set({ status: "escalated", updatedAt: new Date() })
      .where(eq(incidents.id, i.id));
    await event(tx, i.id, me.id, "Escaladé au support");
    await notifyOpsStaff(
      tx,
      {
        type: "system",
        title: "Incident escaladé",
        body: `${i.reference} : le livreur demande une réponse prioritaire`,
        link: `/admin/incidents/${i.id}`,
      },
      "incidents.decide",
    );
  });
}

export async function commentIncident(db: Db, me: Me, id: string, text: string) {
  const body = text.trim().slice(0, 1000);
  if (!body) fail("Commentaire vide.");
  return db.transaction(async (tx) => {
    const { i, staff } = await loadFor(tx, me, id);
    if (i.status === "resolved" && !staff) fail("Cet incident est clôturé.");
    await event(tx, i.id, me.id, body);
    if (staff) {
      await notifyUser(tx, i.driverId, {
        type: "system",
        title: `Incident ${i.reference}`,
        body: body.slice(0, 140),
        link: `/driver/incidents/${i.id}`,
      });
    }
  });
}

/** Clôture : indemnité versée sur le solde du livreur (0 = refusée). */
/** Rembourse le restaurant livré pendant la course de l'incident (à la charge
 * de la plateforme) : le dossier rejoint les remboursements à verser. */
export async function refundRestaurantForIncident(
  db: Db,
  me: Me,
  id: string,
  input: { amount: number; reason?: string },
): Promise<{ id: string; reference: string }> {
  const amount = Math.round(input.amount || 0);
  if (!(amount > 0)) fail("Indiquez un montant valide.");
  return db.transaction(async (tx) => {
    const { i } = await loadFor(tx, me, id);
    if (me.role !== "admin") fail("Seule l'équipe rembourse un restaurant.");
    const [o] = await tx
      .select({
        id: orders.id,
        reference: orders.reference,
        restaurantId: orders.restaurantId,
        subtotal: orders.subtotal,
        deliveryFee: orders.deliveryFee,
        discount: orders.discount,
      })
      .from(missions)
      .innerJoin(orders, eq(orders.id, missions.orderId))
      .where(eq(missions.id, i.missionId))
      .for("update", { of: orders });
    if (!o) fail("Commande de la course introuvable.");
    const [{ already }] = await tx
      .select({ already: sum(refunds.amount).mapWith(Number) })
      .from(refunds)
      .where(and(eq(refunds.orderId, o.id), ne(refunds.status, "rejected")));
    const left = o.subtotal + o.deliveryFee - o.discount - (already ?? 0);
    if (amount > left) {
      fail(
        `Pas plus que ce qui reste remboursable sur ${o.reference} (${formatFCFA(Math.max(0, left))}).`,
      );
    }
    const reason = input.reason?.trim().slice(0, 300) || `Incident ${i.reference}`;
    const refund = await createRefund(tx, {
      orderId: o.id,
      source: "incident",
      amount,
      bornBy: "platform",
      liableUserId: null,
      missionId: i.missionId,
      reason,
      createdBy: me.id,
      label: `Incident ${i.reference}`,
    });
    await event(
      tx,
      i.id,
      me.id,
      `Remboursement ${refund.reference} (${formatFCFA(amount)}) créé pour le restaurant`,
    );
    await audit(tx, {
      actorId: me.id,
      module: "incidents",
      action: `Remboursement du restaurant (${refund.reference})`,
      targetType: "incident",
      targetId: i.id,
      after: { amount, refund: refund.reference },
    });
    await notifyUser(tx, o.restaurantId, {
      type: "payment",
      title: "Remboursement en cours",
      body: `${formatFCFA(amount)} sur ${o.reference} suite à un incident de livraison.`,
      link: `/restaurant/orders/${o.id}`,
    });
    return refund;
  });
}

export async function resolveIncident(
  db: Db,
  me: Me,
  id: string,
  input: { awarded: number; note?: string },
) {
  const awarded = Math.max(0, Math.round(input.awarded || 0));
  const note = input.note?.trim().slice(0, 500) || "";
  return db.transaction(async (tx) => {
    const { i } = await loadFor(tx, me, id);
    if (me.role !== "admin") fail("Seule l'équipe clôture un incident.");
    if (i.status === "resolved") fail("Cet incident est déjà clôturé.");
    if (awarded > 0 && i.compensationRequested > 0 && awarded > i.compensationRequested) {
      fail(`Pas plus que l'indemnité demandée (${formatFCFA(i.compensationRequested)}).`);
    }
    const [locked] = await tx
      .update(incidents)
      .set({
        status: "resolved",
        compensationAwarded: awarded,
        resolutionNote: note || null,
        resolvedBy: me.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, i.id))
      .returning({ id: incidents.id });
    if (!locked) fail("Incident introuvable.");
    if (awarded > 0) {
      const label = `Indemnité incident ${i.reference}`;
      await tx.insert(ledgerEntries).values([
        {
          account: "driver",
          userId: i.driverId,
          kind: "adjustment",
          amount: awarded,
          missionId: i.missionId,
          note: label,
        },
        {
          account: "platform",
          userId: null,
          kind: "adjustment",
          amount: -awarded,
          missionId: i.missionId,
          note: label,
        },
      ]);
    }
    await event(
      tx,
      i.id,
      me.id,
      awarded > 0
        ? `Clôturé — indemnité ${formatFCFA(awarded)} accordée${note ? ` (${note})` : ""}`
        : `Clôturé — indemnité refusée${note ? ` (${note})` : ""}`,
    );
    await notifyUser(tx, i.driverId, {
      type: "system",
      title: "Incident traité",
      body:
        awarded > 0
          ? `${i.reference} : indemnité de ${formatFCFA(awarded)} ajoutée à votre solde`
          : `${i.reference} : clôturé sans indemnité${note ? ` (${note})` : ""}`,
      link: `/driver/incidents/${i.id}`,
    });
    await audit(tx, {
      module: "operations",
      actorId: me.id,
      action: awarded > 0 ? "Indemnité incident accordée" : "Incident clôturé sans indemnité",
      targetType: "incident",
      targetId: i.id,
      after: { awarded, note },
    });
  });
}

export async function readIncidents(q: Q, me: Me): Promise<Incident[]> {
  if (me.role !== "driver" && me.role !== "admin") return [];
  if (me.role === "admin") {
    if (!(await hasPermission(q, me.id, INCIDENT_PERMISSION))) return [];
  }
  const rows = await q
    .select({ i: incidents, missionRef: missions.reference })
    .from(incidents)
    .innerJoin(missions, eq(missions.id, incidents.missionId))
    .where(me.role === "driver" ? eq(incidents.driverId, me.id) : undefined)
    .orderBy(desc(incidents.createdAt))
    .limit(500);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.i.id);
  const [events, photos] = await Promise.all([
    q
      .select()
      .from(incidentEvents)
      .where(inArray(incidentEvents.incidentId, ids))
      .orderBy(asc(incidentEvents.createdAt)),
    q
      .select({
        id: incidentPhotos.id,
        incidentId: incidentPhotos.incidentId,
        name: incidentPhotos.name,
        createdAt: incidentPhotos.createdAt,
        key: files.storageKey,
        mime: files.mime,
        size: files.sizeBytes,
      })
      .from(incidentPhotos)
      .innerJoin(files, eq(files.id, incidentPhotos.fileId))
      .where(inArray(incidentPhotos.incidentId, ids)),
  ]);
  const people = await loadPeople(q, [
    ...rows.map((r) => r.i.driverId),
    ...events.map((e) => e.actorId),
  ]);
  const urls = new Map<string, string | undefined>();
  await Promise.all(photos.map(async (p) => urls.set(p.id, await photoUrl(p.key))));
  return rows.map(({ i, missionRef }) => {
    const driverName = people.get(i.driverId)?.name ?? "Livreur";
    return {
      id: i.id,
      reference: i.reference,
      missionRef,
      missionId: i.missionId,
      driverId: i.driverId,
      driverName,
      type: i.type,
      severity: i.severity,
      description: i.description,
      waitedMinutes: i.waitedMinutes,
      compensationRequested: i.compensationRequested,
      compensationAwarded: i.compensationAwarded ?? undefined,
      resolutionNote: i.resolutionNote ?? undefined,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      history: events
        .filter((e) => e.incidentId === i.id)
        .map((e) => ({
          at: e.createdAt.toISOString(),
          actor: (e.actorId && people.get(e.actorId)?.name) || "Équipe Diambar",
          text: e.text,
        })),
      photos: photos
        .filter((p) => p.incidentId === i.id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          size: p.size,
          mime: p.mime,
          kind: "photo" as const,
          dataUrl: urls.get(p.id),
          by: driverName,
          at: p.createdAt.toISOString(),
        })),
    } satisfies Incident;
  });
}
