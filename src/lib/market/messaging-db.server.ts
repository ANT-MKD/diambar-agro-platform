import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  conversationMessages,
  conversationReads,
  conversations,
  files,
  missions,
  notifications,
  orders,
  users,
} from "@/db/schema";
import type { Conversation, DriverConversation } from "@/data/mocks";
import { audit, fail, hasPermission, notifyUser, type Q, type Tx } from "./market-common.server";
import { loadPeople } from "./people.server";
import { isStored, signedUrl } from "./storage.server";

// Messagerie : fils restaurant ↔ producteur et livreur ↔ restaurant. Chacun
// ne lit que ses fils ; l'équipe (super admin, opérations, support) les lit
// tous, peut y répondre au nom de Diambar, les classer et y laisser des
// notes internes que les parties ne voient jamais.

type Role = "restaurant" | "farmer" | "driver" | "admin";
export type Me = { id: string; role: Role };
export type MessageFile = { storageKey: string; mime: string; size: number; name: string };

/** Permission de l'équipe qui lit et répond aux conversations. */
export const MESSAGING_PERMISSION = "messages.view" as const;

export function isMessagingStaff(q: Q, userId: string): Promise<boolean> {
  return hasPermission(q, userId, MESSAGING_PERMISSION);
}

type ConversationRow = typeof conversations.$inferSelect;

async function activeUser(q: Q, id: string, role: Role) {
  const [u] = await q
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, role), eq(users.status, "active")));
  return !!u;
}

/** Retrouve (ou crée) le fil entre la personne et son interlocuteur. */
export async function startConversation(
  db: Db,
  me: Me,
  target: { farmerId?: string; restaurantId?: string },
): Promise<string> {
  if (me.role === "restaurant") {
    const farmerId = target.farmerId ?? fail("Choisissez un producteur.");
    if (!(await activeUser(db, farmerId, "farmer"))) fail("Producteur introuvable.");
    return upsert(db, { kind: "restaurant_farmer", restaurantId: me.id, farmerId });
  }
  const restaurantId = target.restaurantId ?? fail("Choisissez un restaurant.");
  if (me.role === "farmer") {
    // Un producteur écrit aux restaurants qui lui ont commandé.
    const [o] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.farmerId, me.id), eq(orders.restaurantId, restaurantId)))
      .limit(1);
    if (!o) fail("Vous pouvez écrire aux restaurants qui vous ont déjà commandé.");
    return upsert(db, { kind: "restaurant_farmer", restaurantId, farmerId: me.id });
  }
  if (me.role === "driver") {
    // Un livreur écrit au restaurant d'une course qu'il a prise.
    const [m] = await db
      .select({ id: missions.id })
      .from(missions)
      .innerJoin(orders, eq(orders.id, missions.orderId))
      .where(and(eq(missions.driverId, me.id), eq(orders.restaurantId, restaurantId)))
      .orderBy(desc(missions.createdAt))
      .limit(1);
    if (!m) fail("Vous pouvez écrire au restaurant d'une course que vous avez prise.");
    return upsert(db, {
      kind: "driver_restaurant",
      restaurantId,
      driverId: me.id,
      missionId: m.id,
    });
  }
  fail("L'équipe répond dans les fils existants.");
}

async function upsert(
  db: Db,
  v: {
    kind: "restaurant_farmer" | "driver_restaurant";
    restaurantId: string;
    farmerId?: string;
    driverId?: string;
    missionId?: string;
  },
): Promise<string> {
  const find = async () => {
    const [c] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        v.kind === "restaurant_farmer"
          ? and(
              eq(conversations.kind, v.kind),
              eq(conversations.restaurantId, v.restaurantId),
              eq(conversations.farmerId, v.farmerId!),
            )
          : and(
              eq(conversations.kind, v.kind),
              eq(conversations.restaurantId, v.restaurantId),
              eq(conversations.driverId, v.driverId!),
            ),
      );
    return c?.id;
  };
  const existing = await find();
  if (existing) {
    if (v.missionId) {
      await db
        .update(conversations)
        .set({ missionId: v.missionId })
        .where(eq(conversations.id, existing));
    }
    return existing;
  }
  try {
    const [c] = await db
      .insert(conversations)
      .values({
        kind: v.kind,
        restaurantId: v.restaurantId,
        farmerId: v.farmerId ?? null,
        driverId: v.driverId ?? null,
        missionId: v.missionId ?? null,
      })
      .returning({ id: conversations.id });
    return c.id;
  } catch (err) {
    // Créé au même instant par l'autre partie.
    const again = await find();
    if (again) return again;
    throw err;
  }
}

/** Le fil, s'il concerne la personne (ou si elle est de l'équipe). */
async function loadFor(q: Q, me: Me, id: string): Promise<{ c: ConversationRow; staff: boolean }> {
  const [c] = await q.select().from(conversations).where(eq(conversations.id, id));
  if (!c) fail("Conversation introuvable.");
  if (me.role === "admin") {
    if (!(await isMessagingStaff(q, me.id))) fail("Votre rôle ne permet pas la messagerie.");
    return { c, staff: true };
  }
  const mine =
    (me.role === "restaurant" && c.restaurantId === me.id) ||
    (me.role === "farmer" && c.farmerId === me.id) ||
    (me.role === "driver" && c.driverId === me.id);
  if (!mine) fail("Conversation introuvable.");
  return { c, staff: false };
}

const PORTAL: Record<Exclude<Role, "admin">, string> = {
  restaurant: "restaurant",
  farmer: "farmer",
  driver: "driver",
};

/** Prévient sans inonder : une seule notification non lue par fil. */
async function notifyMessage(
  tx: Tx,
  userId: string,
  role: Exclude<Role, "admin">,
  c: ConversationRow,
  from: string,
  preview: string,
) {
  const link =
    role === "restaurant" && c.kind === "driver_restaurant"
      ? "/restaurant/messages"
      : `/${PORTAL[role]}/messages/${c.id}`;
  const [pending] = await tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.link, link),
        isNull(notifications.readAt),
      ),
    )
    .limit(1);
  if (pending) {
    await tx
      .update(notifications)
      .set({ title: `Message de ${from}`, body: preview, createdAt: new Date() })
      .where(eq(notifications.id, pending.id));
    return;
  }
  await notifyUser(tx, userId, {
    type: "message",
    title: `Message de ${from}`,
    body: preview,
    link,
  });
}

export async function sendMessage(
  db: Db,
  me: Me,
  conversationId: string,
  input: { text: string; file?: MessageFile },
) {
  const text = input.text.trim().slice(0, 2000);
  if (!text && !input.file) fail("Message vide.");
  return db.transaction(async (tx) => {
    const { c } = await loadFor(tx, me, conversationId);
    let fileId: string | null = null;
    if (input.file) {
      const [f] = await tx
        .insert(files)
        .values({
          ownerId: me.id,
          storageKey: input.file.storageKey,
          mime: input.file.mime,
          sizeBytes: input.file.size,
        })
        .returning({ id: files.id });
      fileId = f.id;
    }
    const now = new Date();
    await tx.insert(conversationMessages).values({
      conversationId: c.id,
      authorId: me.id,
      authorRole: me.role,
      text,
      fileId,
      attachmentName: input.file?.name.slice(0, 120) ?? null,
    });
    const preview = (text || input.file?.name || "Pièce jointe").slice(0, 140);
    await tx
      .update(conversations)
      .set({ lastMessageAt: now, lastMessagePreview: preview })
      .where(eq(conversations.id, c.id));
    await markRead(tx, me.id, c.id, now);
    const people = await loadPeople(tx, [me.id]);
    const from = me.role === "admin" ? "l'équipe Diambar" : (people.get(me.id)?.name ?? "—");
    const recipients: [string | null, Exclude<Role, "admin">][] = [
      [c.restaurantId, "restaurant"],
      [c.farmerId, "farmer"],
      [c.driverId, "driver"],
    ];
    for (const [userId, role] of recipients) {
      if (!userId || userId === me.id) continue;
      await notifyMessage(tx, userId, role, c, from, preview);
    }
  });
}

async function markRead(q: Q, userId: string, conversationId: string, at = new Date()) {
  await q
    .insert(conversationReads)
    .values({ conversationId, userId, lastReadAt: at })
    .onConflictDoUpdate({
      target: [conversationReads.conversationId, conversationReads.userId],
      set: { lastReadAt: at },
    });
}

export async function markConversationRead(db: Db, me: Me, conversationId: string) {
  const { c } = await loadFor(db, me, conversationId);
  await markRead(db, me.id, c.id);
}

// --- Équipe : classement et notes internes ------------------------------------------------

export async function updateConversationMeta(
  db: Db,
  me: Me,
  conversationId: string,
  input: { priority?: "normal" | "important" | "urgent"; tags?: string[] },
) {
  const { c, staff } = await loadFor(db, me, conversationId);
  if (!staff) fail("Réservé à l'équipe.");
  const set: Partial<typeof conversations.$inferInsert> = {};
  if (input.priority) set.priority = input.priority;
  if (input.tags) {
    set.tags = [...new Set(input.tags.map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(
      0,
      10,
    );
  }
  if (Object.keys(set).length) {
    await db.update(conversations).set(set).where(eq(conversations.id, c.id));
  }
}

export async function addConversationNote(db: Db, me: Me, conversationId: string, text: string) {
  const note = text.trim().slice(0, 2000);
  if (!note) fail("Note vide.");
  const { c, staff } = await loadFor(db, me, conversationId);
  if (!staff) fail("Réservé à l'équipe.");
  await db.insert(conversationMessages).values({
    conversationId: c.id,
    authorId: me.id,
    authorRole: "admin",
    text: note,
    internal: true,
  });
  await audit(db, {
    actorId: me.id,
    action: "Note interne (messagerie)",
    targetType: "conversation",
    targetId: c.id,
  });
}

export async function linkConversationTicket(q: Q, conversationId: string, ticketId: string) {
  await q.update(conversations).set({ ticketId }).where(eq(conversations.id, conversationId));
}

// --- Lecture ------------------------------------------------------------------------------

const signed = new Map<string, { url: string; until: number }>();
async function fileUrl(key: string): Promise<string | undefined> {
  if (!isStored(key)) return undefined;
  const hit = signed.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = await signedUrl(key);
  if (!url) return undefined;
  signed.set(key, { url, until: Date.now() + 10 * 60_000 });
  if (signed.size > 2000) signed.clear();
  return url;
}

export async function readConversations(
  q: Q,
  me: Me,
): Promise<{ conversations: Conversation[]; driverConversations: DriverConversation[] }> {
  const staff = me.role === "admin" && (await isMessagingStaff(q, me.id));
  if (me.role === "admin" && !staff) return { conversations: [], driverConversations: [] };
  const rows = await q
    .select()
    .from(conversations)
    .where(
      staff
        ? undefined
        : or(
            eq(conversations.restaurantId, me.id),
            eq(conversations.farmerId, me.id),
            eq(conversations.driverId, me.id),
          ),
    )
    .orderBy(desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`))
    .limit(staff ? 300 : 100);
  if (!rows.length) return { conversations: [], driverConversations: [] };
  const ids = rows.map((r) => r.id);
  const [messages, reads] = await Promise.all([
    q
      .select({
        m: conversationMessages,
        storageKey: files.storageKey,
        mime: files.mime,
      })
      .from(conversationMessages)
      .leftJoin(files, eq(files.id, conversationMessages.fileId))
      .where(inArray(conversationMessages.conversationId, ids))
      .orderBy(asc(conversationMessages.createdAt)),
    q
      .select()
      .from(conversationReads)
      .where(
        and(inArray(conversationReads.conversationId, ids), eq(conversationReads.userId, me.id)),
      ),
  ]);
  const people = await loadPeople(q, [
    ...rows.flatMap((r) => [r.restaurantId, r.farmerId, r.driverId]),
    ...messages.map((x) => x.m.authorId),
  ]);
  const lastRead = new Map(reads.map((r) => [r.conversationId, r.lastReadAt.getTime()]));

  const conversationsOut: Conversation[] = [];
  const driverOut: DriverConversation[] = [];
  for (const r of rows) {
    const all = messages.filter((x) => x.m.conversationId === r.id);
    const visible = all.filter((x) => !x.m.internal);
    const seen = lastRead.get(r.id) ?? 0;
    const unread = visible.filter(
      (x) => x.m.authorId !== me.id && x.m.createdAt.getTime() > seen,
    ).length;
    const notes = staff
      ? all
          .filter((x) => x.m.internal)
          .map((x) => ({
            id: x.m.id,
            at: x.m.createdAt.toISOString(),
            actor: people.get(x.m.authorId ?? "")?.name ?? "Équipe",
            text: x.m.text,
          }))
      : undefined;
    const attachmentOf = async (x: (typeof all)[number]) =>
      x.storageKey
        ? {
            name: x.m.attachmentName ?? "pièce jointe",
            mime: x.mime ?? "application/octet-stream",
            dataUrl: (await fileUrl(x.storageKey)) ?? "",
          }
        : undefined;
    const common = {
      id: r.id,
      restaurantId: r.restaurantId,
      restaurantName: people.get(r.restaurantId)?.name,
      lastMessage: r.lastMessagePreview ?? "",
      lastAt: (r.lastMessageAt ?? r.createdAt).toISOString(),
      unread,
      priority: r.priority,
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      ticketId: r.ticketId ?? undefined,
      ...(notes ? { internalNotes: notes } : {}),
    };
    if (r.kind === "restaurant_farmer") {
      conversationsOut.push({
        ...common,
        farmerId: r.farmerId!,
        farmerName: people.get(r.farmerId ?? "")?.name,
        messages: await Promise.all(
          visible.map(async (x) => ({
            id: x.m.id,
            from: x.m.authorRole === "driver" ? "admin" : x.m.authorRole,
            text: x.m.text,
            at: x.m.createdAt.toISOString(),
            ...(x.m.authorRole === "admin"
              ? { senderName: `${people.get(x.m.authorId ?? "")?.name ?? "Équipe"} · Diambar` }
              : {}),
            attachment: await attachmentOf(x),
          })),
        ),
      });
    } else {
      // Vu du livreur : « me » = le livreur, « them » = le restaurant ou l'équipe.
      driverOut.push({
        ...common,
        driverId: r.driverId ?? undefined,
        driverName: people.get(r.driverId ?? "")?.name,
        missionId: r.missionId ?? undefined,
        messages: await Promise.all(
          visible.map(async (x) => ({
            id: x.m.id,
            from: x.m.authorRole === "driver" ? ("me" as const) : ("them" as const),
            text: x.m.text,
            at: x.m.createdAt.toISOString(),
            senderName:
              x.m.authorRole === "admin"
                ? `${people.get(x.m.authorId ?? "")?.name ?? "Équipe"} · Diambar`
                : people.get(x.m.authorId ?? "")?.name,
            attachment: await attachmentOf(x),
          })),
        ),
      });
    }
  }
  return { conversations: conversationsOut, driverConversations: driverOut };
}
