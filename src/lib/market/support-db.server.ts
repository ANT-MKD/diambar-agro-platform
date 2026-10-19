import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  conversations,
  missions,
  orders,
  supportMessages,
  supportTickets,
  users,
} from "@/db/schema";
import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketRole,
  TicketStatus,
} from "@/data/support";
import {
  audit,
  fail,
  hasPermission,
  nextNumber,
  notifyUser,
  staffWithPermission,
  type Q,
  type Tx,
} from "./market-common.server";
import { linkConversationTicket } from "./messaging-db.server";
import { loadPeople } from "./people.server";

// Support : demandes d'aide des restaurants, producteurs et livreurs, suivies
// par l'équipe (super admin, opérations, support). Les notes internes de
// l'équipe ne partent jamais vers la personne.

type Role = "restaurant" | "farmer" | "driver" | "admin";
type Me = { id: string; role: Role };

const CATEGORY_PRIORITY: Record<TicketCategory, TicketPriority> = {
  payments: "high",
  delivery: "high",
  products: "medium",
  account: "medium",
  technical: "low",
  other: "low",
};

const PORTAL: Record<Exclude<Role, "admin">, string> = {
  restaurant: "/restaurant/support",
  farmer: "/farmer/support",
  driver: "/driver/settings/help",
};

/** Permission de l'équipe qui répond aux demandes de support. */
export const SUPPORT_PERMISSION = "support.respond" as const;

function isSupportStaff(q: Q, userId: string): Promise<boolean> {
  return hasPermission(q, userId, SUPPORT_PERMISSION);
}

async function notifySupportStaff(q: Q, n: { title: string; body: string }) {
  for (const id of await staffWithPermission(q, SUPPORT_PERMISSION)) {
    await notifyUser(q, id, { type: "system", ...n, link: "/admin/support" });
  }
}

/** Commande citée dans une demande : seulement une commande de la personne. */
async function orderFor(q: Q, me: Me, reference: string): Promise<string | null> {
  const ref = reference.trim().toUpperCase();
  if (!ref) return null;
  const [o] = await q
    .select({ id: orders.id, restaurantId: orders.restaurantId, farmerId: orders.farmerId })
    .from(orders)
    .where(eq(orders.reference, ref));
  if (!o) fail(`Commande ${ref} introuvable.`);
  if (me.role === "restaurant" && o.restaurantId === me.id) return o.id;
  if (me.role === "farmer" && o.farmerId === me.id) return o.id;
  if (me.role === "driver") {
    const [m] = await q
      .select({ id: missions.id })
      .from(missions)
      .where(and(eq(missions.orderId, o.id), eq(missions.driverId, me.id)));
    if (m) return o.id;
  }
  fail(`Commande ${ref} introuvable.`);
}

async function insertTicket(
  tx: Tx,
  input: {
    userId: string;
    role: Exclude<Role, "admin">;
    subject: string;
    category: TicketCategory;
    message: string;
    authorId: string;
    authorRole: Exclude<Role, "admin"> | "platform";
    orderId: string | null;
  },
) {
  const reference = `TCK-${String(await nextNumber(tx, "ticket_reference_seq")).padStart(4, "0")}`;
  const [t] = await tx
    .insert(supportTickets)
    .values({
      reference,
      userId: input.userId,
      subject: input.subject,
      category: input.category,
      priority: CATEGORY_PRIORITY[input.category],
      orderId: input.orderId,
    })
    .returning({ id: supportTickets.id });
  await tx.insert(supportMessages).values({
    ticketId: t.id,
    authorId: input.authorId,
    authorRole: input.authorRole,
    text: input.message,
  });
  return { id: t.id, reference };
}

export async function createTicket(
  db: Db,
  me: Me,
  input: {
    subject: string;
    message: string;
    category: TicketCategory;
    orderRef?: string;
    /** Alerte SOS d'un livreur : en tête de file. */
    urgent?: boolean;
  },
): Promise<{ id: string; reference: string }> {
  if (me.role === "admin") fail("L'équipe ouvre un ticket depuis la messagerie.");
  if (input.urgent && me.role !== "driver") fail("Alerte réservée aux livreurs.");
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < 4) fail("Indiquez un objet (4 caractères minimum).");
  if (message.length < 10) fail("Décrivez votre demande (10 caractères minimum).");
  return db.transaction(async (tx) => {
    const orderId = input.orderRef ? await orderFor(tx, me, input.orderRef) : null;
    const t = await insertTicket(tx, {
      userId: me.id,
      role: me.role as Exclude<Role, "admin">,
      subject: subject.slice(0, 160),
      category: input.category,
      message: message.slice(0, 4000),
      authorId: me.id,
      authorRole: me.role as Exclude<Role, "admin">,
      orderId,
    });
    if (input.urgent) {
      await tx
        .update(supportTickets)
        .set({ priority: "urgent" })
        .where(eq(supportTickets.id, t.id));
    }
    const people = await loadPeople(tx, [me.id]);
    await notifySupportStaff(tx, {
      title: input.urgent ? "🚨 Alerte SOS livreur" : "Nouvelle demande d'aide",
      body: `${t.reference} · ${people.get(me.id)?.name ?? "—"} : ${subject.slice(0, 100)}`,
    });
    return t;
  });
}

async function loadTicket(q: Q, me: Me, id: string) {
  const [t] = await q.select().from(supportTickets).where(eq(supportTickets.id, id));
  if (!t) fail("Demande introuvable.");
  if (me.role === "admin") {
    if (!(await isSupportStaff(q, me.id))) fail("Votre rôle ne permet pas le support.");
    return { t, staff: true };
  }
  if (t.userId !== me.id) fail("Demande introuvable.");
  return { t, staff: false };
}

/** Réponse : de la personne (la demande se rouvre) ou de l'équipe (elle
 * passe à « Répondu »), ou note interne de l'équipe. */
export async function replyTicket(
  db: Db,
  me: Me,
  id: string,
  input: { text: string; internal?: boolean },
) {
  const text = input.text.trim().slice(0, 4000);
  if (!text) fail("Message vide.");
  return db.transaction(async (tx) => {
    const { t, staff } = await loadTicket(tx, me, id);
    const internal = staff && input.internal === true;
    if (!staff && t.status === "closed") fail("Cette demande est fermée : ouvrez-en une nouvelle.");
    await tx.insert(supportMessages).values({
      ticketId: t.id,
      authorId: me.id,
      authorRole: staff ? "platform" : (me.role as Exclude<Role, "admin">),
      text,
      internal,
    });
    if (internal) return;
    const status: TicketStatus = staff ? "answered" : "open";
    await tx
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, t.id));
    if (staff) {
      const [u] = await tx.select({ role: users.role }).from(users).where(eq(users.id, t.userId));
      const role = (u?.role ?? "restaurant") as Exclude<Role, "admin">;
      await notifyUser(tx, t.userId, {
        type: "system",
        title: `Réponse de l'équipe · ${t.reference}`,
        body: text.slice(0, 140),
        link: PORTAL[role],
      });
    } else if (t.assigneeId) {
      await notifyUser(tx, t.assigneeId, {
        type: "system",
        title: `Nouveau message · ${t.reference}`,
        body: text.slice(0, 140),
        link: "/admin/support",
      });
    } else {
      await notifySupportStaff(tx, {
        title: `Nouveau message · ${t.reference}`,
        body: text.slice(0, 140),
      });
    }
  });
}

export async function setTicketStatus(db: Db, me: Me, id: string, status: TicketStatus) {
  return db.transaction(async (tx) => {
    const { t, staff } = await loadTicket(tx, me, id);
    if (!staff) fail("Réservé à l'équipe.");
    await tx
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, t.id));
    await audit(tx, {
      actorId: me.id,
      action: `Demande d'aide : ${status === "closed" ? "fermée" : status === "open" ? "rouverte" : "répondue"}`,
      targetType: "support_ticket",
      targetId: t.id,
      before: { status: t.status },
      after: { status },
    });
  });
}

export async function assignTicket(db: Db, me: Me, id: string, assigneeId: string | null) {
  return db.transaction(async (tx) => {
    const { t, staff } = await loadTicket(tx, me, id);
    if (!staff) fail("Réservé à l'équipe.");
    if (assigneeId && !(await isSupportStaff(tx, assigneeId))) {
      fail("Cette personne ne traite pas le support.");
    }
    await tx
      .update(supportTickets)
      .set({ assigneeId, updatedAt: new Date() })
      .where(eq(supportTickets.id, t.id));
    if (assigneeId && assigneeId !== me.id) {
      await notifyUser(tx, assigneeId, {
        type: "system",
        title: "Demande d'aide assignée",
        body: `${t.reference} : ${t.subject}`,
        link: "/admin/support",
      });
    }
  });
}

/** L'équipe ouvre un ticket à partir d'un fil de messagerie (pour le suivre). */
export async function ticketFromConversation(
  db: Db,
  me: Me,
  conversationId: string,
  input: { subject: string; category: TicketCategory },
): Promise<{ id: string; reference: string }> {
  if (!(await isSupportStaff(db, me.id))) fail("Votre rôle ne permet pas le support.");
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!c) fail("Conversation introuvable.");
    if (c.ticketId) fail("Un ticket est déjà ouvert pour ce fil.");
    // Le ticket est rattaché au restaurant du fil (ou au livreur s'il n'y en a pas).
    const userId = c.restaurantId;
    const t = await insertTicket(tx, {
      userId,
      role: "restaurant",
      subject: input.subject.trim().slice(0, 160) || "Suivi d'une conversation",
      category: input.category,
      message: "Ticket ouvert par l'équipe pour suivre une conversation de la messagerie.",
      authorId: me.id,
      authorRole: "platform",
      orderId: null,
    });
    await tx.update(supportTickets).set({ assigneeId: me.id }).where(eq(supportTickets.id, t.id));
    await linkConversationTicket(tx, c.id, t.id);
    return t;
  });
}

/** Demandes telles que les écrans les affichent : les siennes, ou toutes
 * pour l'équipe. */
export async function readTickets(q: Q, me: Me): Promise<SupportTicket[]> {
  const staff = me.role === "admin" && (await isSupportStaff(q, me.id));
  if (me.role === "admin" && !staff) return [];
  const rows = await q
    .select({ t: supportTickets, role: users.role, orderRef: orders.reference })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .leftJoin(orders, eq(orders.id, supportTickets.orderId))
    .where(staff ? undefined : eq(supportTickets.userId, me.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(staff ? 300 : 100);
  if (!rows.length) return [];
  const messages = await q
    .select()
    .from(supportMessages)
    .where(
      inArray(
        supportMessages.ticketId,
        rows.map((r) => r.t.id),
      ),
    )
    .orderBy(asc(supportMessages.createdAt));
  const people = await loadPeople(q, [
    ...rows.flatMap((r) => [r.t.userId, r.t.assigneeId]),
    ...messages.map((m) => m.authorId),
  ]);
  return rows.map(({ t, role, orderRef }) => {
    const thread = messages.filter((m) => m.ticketId === t.id && (staff || !m.internal));
    return {
      id: t.id,
      reference: t.reference,
      subject: t.subject,
      message: thread[0]?.text ?? "",
      fromName: people.get(t.userId)?.name ?? "—",
      fromRole: (role === "admin" ? "restaurant" : role) as TicketRole,
      category: t.category,
      priority: t.priority,
      assignee: t.assigneeId ? (people.get(t.assigneeId)?.name ?? null) : null,
      assigneeId: t.assigneeId ?? undefined,
      orderRef: orderRef ?? undefined,
      orderId: t.orderId ?? undefined,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      messages: thread.map((m) => ({
        id: m.id,
        at: m.createdAt.toISOString(),
        authorRole: m.authorRole === "platform" ? "platform" : (m.authorRole as TicketRole),
        authorName:
          m.authorRole === "platform"
            ? `${people.get(m.authorId ?? "")?.name ?? "Équipe"} · Diambar`
            : (people.get(m.authorId ?? "")?.name ?? "—"),
        text: m.text,
        internal: m.internal,
      })),
    };
  });
}
