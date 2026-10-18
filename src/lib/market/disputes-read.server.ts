import { asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  disputeAttachments,
  disputeEvents,
  disputeMessages,
  disputes,
  farmers,
  files,
  missions,
  orders,
  restaurants,
  users,
} from "@/db/schema";
import type { Dispute, DisputeParty } from "@/data/disputes";
import type { Q } from "./market-common.server";
import { isStored, signedUrl } from "./storage.server";

// Litiges tels que les écrans les affichent : ceux de la personne (ouverts
// par elle ou la mettant en cause), ou tous pour l'équipe. Les notes
// internes de l'équipe ne partent jamais vers les parties.

const signed = new Map<string, { url: string; until: number }>();
async function photoUrl(key: string): Promise<string | undefined> {
  if (!isStored(key)) return undefined;
  const hit = signed.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = await signedUrl(key);
  if (!url) return undefined;
  signed.set(key, { url, until: Date.now() + 10 * 60_000 });
  if (signed.size > 2000) signed.clear();
  return url;
}

export async function readDisputes(
  q: Q,
  me: { id: string; role: "restaurant" | "farmer" | "driver" | "admin" },
): Promise<Dispute[]> {
  const rows = await q
    .select()
    .from(disputes)
    .where(
      me.role === "admin"
        ? undefined
        : or(eq(disputes.openedBy, me.id), eq(disputes.againstUserId, me.id)),
    )
    .orderBy(desc(disputes.createdAt))
    .limit(me.role === "admin" ? 300 : 100);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const staff = me.role === "admin";

  const [messages, events, attachments] = await Promise.all([
    q
      .select()
      .from(disputeMessages)
      .where(inArray(disputeMessages.disputeId, ids))
      .orderBy(asc(disputeMessages.createdAt)),
    q
      .select()
      .from(disputeEvents)
      .where(inArray(disputeEvents.disputeId, ids))
      .orderBy(asc(disputeEvents.createdAt)),
    q
      .select({
        id: disputeAttachments.id,
        disputeId: disputeAttachments.disputeId,
        messageId: disputeAttachments.messageId,
        name: disputeAttachments.name,
        createdAt: disputeAttachments.createdAt,
        storageKey: files.storageKey,
        mime: files.mime,
        size: files.sizeBytes,
        ownerId: files.ownerId,
      })
      .from(disputeAttachments)
      .innerJoin(files, eq(files.id, disputeAttachments.fileId))
      .where(inArray(disputeAttachments.disputeId, ids)),
  ]);

  // Noms affichés : établissement, exploitation, ou prénom et nom.
  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.openedBy);
    if (r.againstUserId) userIds.add(r.againstUserId);
    if (r.assigneeId) userIds.add(r.assigneeId);
    if (r.decidedBy) userIds.add(r.decidedBy);
  }
  for (const m of messages) if (m.authorId) userIds.add(m.authorId);
  for (const e of events) if (e.actorId) userIds.add(e.actorId);
  for (const a of attachments) if (a.ownerId) userIds.add(a.ownerId);
  const list = [...userIds];
  const [people, restos, farms] = list.length
    ? await Promise.all([
        q
          .select({
            id: users.id,
            role: users.role,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, list)),
        q
          .select({ id: restaurants.userId, name: restaurants.name })
          .from(restaurants)
          .where(inArray(restaurants.userId, list)),
        q
          .select({ id: farmers.userId, name: farmers.farmName })
          .from(farmers)
          .where(inArray(farmers.userId, list)),
      ])
    : [[], [], []];
  const nameOf = (id: string | null | undefined, fallback = "Équipe Diambar") => {
    if (!id) return fallback;
    const p = people.find((x) => x.id === id);
    if (p?.role === "restaurant") return restos.find((r) => r.id === id)?.name ?? "Restaurant";
    if (p?.role === "farmer") return farms.find((f) => f.id === id)?.name ?? "Producteur";
    if (p?.role === "admin") return `${p.firstName} ${p.lastName}`.trim() || fallback;
    return p ? `${p.firstName} ${p.lastName}`.trim() : fallback;
  };

  const orderIds = rows.map((r) => r.orderId).filter((x): x is string => !!x);
  const missionIds = rows.map((r) => r.missionId).filter((x): x is string => !!x);
  const [orderRefs, missionRefs] = await Promise.all([
    orderIds.length
      ? q
          .select({ id: orders.id, reference: orders.reference })
          .from(orders)
          .where(inArray(orders.id, orderIds))
      : [],
    missionIds.length
      ? q
          .select({ id: missions.id, reference: missions.reference })
          .from(missions)
          .where(inArray(missions.id, missionIds))
      : [],
  ]);

  const out: Dispute[] = [];
  for (const r of rows) {
    const files = await Promise.all(
      attachments
        .filter((a) => a.disputeId === r.id)
        .map(async (a) => ({
          id: a.id,
          messageId: a.messageId,
          name: a.name,
          size: a.size,
          mime: a.mime,
          kind: "photo" as const,
          dataUrl: await photoUrl(a.storageKey),
          at: a.createdAt.toISOString(),
          by: nameOf(a.ownerId),
        })),
    );
    const visible = messages.filter((m) => m.disputeId === r.id && (staff || !m.internal));
    const visibleIds = new Set(visible.map((m) => m.id));
    const shownFiles = files.filter((f) => !f.messageId || visibleIds.has(f.messageId));
    const strip = ({ messageId: _m, ...f }: (typeof files)[number]) => f;
    out.push({
      id: r.id,
      reference: r.reference,
      category: r.category,
      subcategory: r.subcategory,
      description: r.description,
      orderRef:
        orderRefs.find((o) => o.id === r.orderId)?.reference ??
        missionRefs.find((m) => m.id === r.missionId)?.reference ??
        "—",
      orderId: r.orderId ?? undefined,
      missionId: r.missionId ?? undefined,
      hasGpsTrack: false,
      openedByRole: r.openedByRole,
      openedByName: nameOf(r.openedBy),
      againstRole: r.againstRole,
      againstName: r.againstRole === "platform" ? "Diambar Agro" : nameOf(r.againstUserId, "—"),
      claimedAmount: r.claimedAmount,
      grantedAmount: r.grantedAmount,
      liableParty: (r.liableParty as DisputeParty | null) ?? null,
      status: r.status,
      priority: r.priority,
      channel: "app",
      openedAt: r.createdAt.toISOString(),
      slaDueAt: r.slaDueAt.toISOString(),
      escalations: r.escalations,
      assignee: r.assigneeId ? nameOf(r.assigneeId) : null,
      assigneeId: r.assigneeId ?? undefined,
      attachments: shownFiles.map(strip),
      messages: visible.map((m) => ({
        id: m.id,
        at: m.createdAt.toISOString(),
        authorRole: m.authorRole,
        authorName: m.authorRole === "platform" ? nameOf(m.authorId) : nameOf(m.authorId),
        text: m.text,
        internal: m.internal,
        attachments: shownFiles.filter((f) => f.messageId === m.id).map(strip),
      })),
      events: events
        .filter((e) => e.disputeId === r.id)
        .map((e) => ({
          id: e.id,
          at: e.createdAt.toISOString(),
          actor: nameOf(e.actorId),
          label: e.label,
          detail: e.detail ?? undefined,
        })),
      decision:
        r.outcome && r.decidedAt
          ? {
              at: r.decidedAt.toISOString(),
              by: nameOf(r.decidedBy),
              outcome: r.outcome,
              reason: r.decisionReason ?? "",
              grantedAmount: r.grantedAmount ?? 0,
              debitedParty: (r.liableParty as DisputeParty | null) ?? "platform",
            }
          : undefined,
    });
  }
  return out;
}
