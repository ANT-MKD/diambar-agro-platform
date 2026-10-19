// Messagerie et support en base (tests sur une vraie base PostgreSQL,
// fichier « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  adminProfiles,
  conversations,
  missions,
  notifications,
  products,
  settings,
  supportTickets,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { acceptMission, confirmOrder, placeOrder } from "./market-db.server";
import {
  addConversationNote,
  markConversationRead,
  readConversations,
  sendMessage,
  startConversation,
} from "./messaging-db.server";
import {
  assignTicket,
  createTicket,
  readTickets,
  replyTicket,
  setTicketStatus,
  ticketFromConversation,
} from "./support-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_messaging_test";

describe.skipIf(!adminUrl)("messagerie et support (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let otherRestaurantId: string;
  let driverId: string;
  let adminId: string;
  let financeId: string;
  let orderRef: string;
  let convId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const me = (id: string, role: "restaurant" | "farmer" | "driver" | "admin") => ({ id, role });
  const notifs = async (userId: string) =>
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, "message")));

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const u = new URL(adminUrl!);
    u.pathname = `/${DB_NAME}`;
    ({ db, close } = createDb(u.toString(), { max: 4 }));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
    farmerId = await idOf("agriculteur@diambar.sn");
    restaurantId = await idOf("restaurant@diambar.sn");
    otherRestaurantId = await idOf("keurmassar.dib@gmail.com");
    driverId = await idOf("livreur@diambar.sn");
    adminId = await idOf("admin@diambar.sn");
    const [f] = await db
      .insert(users)
      .values({
        role: "admin",
        email: "finance.msg@exemple.sn",
        phone: "760000012",
        passwordHash: "x",
        firstName: "Fina",
        lastName: "Nance",
        status: "active",
      })
      .returning();
    financeId = f.id;
    await db.insert(adminProfiles).values({ userId: financeId, adminRole: "finance" });
    await db
      .insert(settings)
      .values({
        key: "payment_methods",
        value: {
          wave: { enabled: true, number: "770000000" },
          orangeMoney: { enabled: false, number: "" },
          cashOnDelivery: { enabled: true },
        },
      })
      .onConflictDoNothing();
    await db.update(vehicles).set({ capacityKg: 900 }).where(eq(vehicles.driverId, driverId));
  });

  afterAll(async () => {
    await close?.();
  });

  it("restaurant ↔ producteur : un seul fil, le producteur n'écrit qu'à ses clients", async () => {
    convId = await startConversation(db, me(restaurantId, "restaurant"), { farmerId });
    expect(await startConversation(db, me(restaurantId, "restaurant"), { farmerId })).toBe(convId);
    await expect(
      startConversation(db, me(farmerId, "farmer"), { restaurantId: otherRestaurantId }),
    ).rejects.toThrow(/déjà commandé/);
    // Le producteur retrouve le même fil (le restaurant lui a commandé ensuite).
    const [tomato] = await db.select().from(products).where(eq(products.farmerId, farmerId));
    await db
      .update(products)
      .set({ stockQty: 500, status: "active" })
      .where(eq(products.id, tomato.id));
    const slot = new Date();
    slot.setUTCDate(slot.getUTCDate() + 3);
    slot.setUTCHours(9, 0, 0, 0);
    const placed = await placeOrder(db, restaurantId, {
      lines: [{ productId: tomato.id, qty: 10 }],
      deliveryAddress: "Le Baobab, Dakar Plateau",
      slotStart: slot.toISOString(),
      slotLabel: "Dans 3 jours · 09:00",
      paymentMethod: "Espèces",
      shortagePreference: "partial",
    });
    orderRef = placed.orders[0].reference;
    expect(await startConversation(db, me(farmerId, "farmer"), { restaurantId })).toBe(convId);
    await confirmOrder(db, farmerId, placed.orders[0].id, {});
  });

  it("messages : notification unique par fil, non-lus, lecture", async () => {
    await sendMessage(db, me(restaurantId, "restaurant"), convId, {
      text: "Bonjour, il reste des tomates ?",
    });
    await sendMessage(db, me(restaurantId, "restaurant"), convId, { text: "Pour demain matin." });
    const n = await notifs(farmerId);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ body: "Pour demain matin.", link: `/farmer/messages/${convId}` });
    let view = await readConversations(db, me(farmerId, "farmer"));
    expect(view.conversations[0]).toMatchObject({ id: convId, unread: 2 });
    expect(view.conversations[0].messages.map((m) => m.from)).toEqual(["restaurant", "restaurant"]);
    await markConversationRead(db, me(farmerId, "farmer"), convId);
    view = await readConversations(db, me(farmerId, "farmer"));
    expect(view.conversations[0].unread).toBe(0);
    await expect(
      sendMessage(db, me(otherRestaurantId, "restaurant"), convId, { text: "intrus" }),
    ).rejects.toThrow(/introuvable/);
  });

  it("équipe : réponse visible, note interne cachée aux parties", async () => {
    await sendMessage(db, me(adminId, "admin"), convId, { text: "L'équipe suit votre échange." });
    await addConversationNote(db, me(adminId, "admin"), convId, "Client fidèle, à soigner.");
    const resto = await readConversations(db, me(restaurantId, "restaurant"));
    const c = resto.conversations[0];
    expect(c.messages.at(-1)).toMatchObject({
      from: "admin",
      text: "L'équipe suit votre échange.",
    });
    expect(c.messages.at(-1)?.senderName).toContain("Diambar");
    expect(c.internalNotes).toBeUndefined();
    const staff = await readConversations(db, me(adminId, "admin"));
    expect(staff.conversations[0].internalNotes?.[0].text).toBe("Client fidèle, à soigner.");
    // Finance ne lit pas la messagerie.
    expect((await readConversations(db, me(financeId, "admin"))).conversations).toHaveLength(0);
  });

  it("livreur ↔ restaurant : seulement autour d'une course prise", async () => {
    await expect(startConversation(db, me(driverId, "driver"), { restaurantId })).rejects.toThrow(
      /course/,
    );
    const [m] = await db.select().from(missions);
    await acceptMission(db, driverId, m.id);
    const id = await startConversation(db, me(driverId, "driver"), { restaurantId });
    await sendMessage(db, me(driverId, "driver"), id, { text: "J'arrive dans 10 minutes." });
    await sendMessage(db, me(restaurantId, "restaurant"), id, { text: "Entrée côté cuisine." });
    const driverView = await readConversations(db, me(driverId, "driver"));
    expect(driverView.driverConversations[0].messages.map((x) => x.from)).toEqual(["me", "them"]);
    expect(driverView.driverConversations[0]).toMatchObject({ missionId: m.id, unread: 1 });
    const restoView = await readConversations(db, me(restaurantId, "restaurant"));
    expect(restoView.driverConversations[0].driverName).toBeTruthy();
    const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
    expect(c.kind).toBe("driver_restaurant");
  });

  it("support : demande, réponse de l'équipe, réponse de la personne, note interne", async () => {
    await expect(
      createTicket(db, me(otherRestaurantId, "restaurant"), {
        subject: "Ma commande",
        message: "Je n'ai pas reçu ma commande à l'heure prévue.",
        category: "delivery",
        orderRef,
      }),
    ).rejects.toThrow(/introuvable/);
    const t = await createTicket(db, me(restaurantId, "restaurant"), {
      subject: "Retard de livraison",
      message: "La livraison prévue ce matin n'est pas encore arrivée.",
      category: "delivery",
      orderRef,
    });
    expect(t.reference).toBe("TCK-0001");
    const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, t.id));
    expect(row).toMatchObject({ priority: "high", status: "open" });
    await assignTicket(db, me(adminId, "admin"), t.id, adminId);
    await replyTicket(db, me(adminId, "admin"), t.id, {
      text: "Note : appeler le livreur.",
      internal: true,
    });
    await replyTicket(db, me(adminId, "admin"), t.id, {
      text: "Le livreur arrive, merci de patienter.",
    });
    let mine = await readTickets(db, me(restaurantId, "restaurant"));
    expect(mine[0]).toMatchObject({ status: "answered", orderRef, assigneeId: adminId });
    expect(mine[0].messages.map((m) => m.text)).not.toContain("Note : appeler le livreur.");
    const replied = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, restaurantId), eq(notifications.link, "/restaurant/support")),
      );
    expect(replied).toHaveLength(1);
    await replyTicket(db, me(restaurantId, "restaurant"), t.id, { text: "Merci, bien reçu." });
    mine = await readTickets(db, me(restaurantId, "restaurant"));
    expect(mine[0].status).toBe("open");
    await setTicketStatus(db, me(adminId, "admin"), t.id, "closed");
    await expect(
      replyTicket(db, me(restaurantId, "restaurant"), t.id, { text: "Encore une question" }),
    ).rejects.toThrow(/fermée/);
    await expect(setTicketStatus(db, me(financeId, "admin"), t.id, "open")).rejects.toThrow(
      /support/,
    );
    expect(await readTickets(db, me(otherRestaurantId, "restaurant"))).toHaveLength(0);
  });

  it("ticket ouvert depuis un fil, une seule fois", async () => {
    const t = await ticketFromConversation(db, me(adminId, "admin"), convId, {
      subject: "Suivi client",
      category: "other",
    });
    const [c] = await db.select().from(conversations).where(eq(conversations.id, convId));
    expect(c.ticketId).toBe(t.id);
    await expect(
      ticketFromConversation(db, me(adminId, "admin"), convId, { subject: "x", category: "other" }),
    ).rejects.toThrow(/déjà ouvert/);
  });
});
