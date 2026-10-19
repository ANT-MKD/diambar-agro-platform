// Litiges en base (tests sur une vraie base PostgreSQL, fichier « .db ») :
// ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  adminProfiles,
  disputes,
  ledgerEntries,
  missions,
  notifications,
  orders,
  products,
  refunds,
  settings,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import {
  assignDispute,
  escalateDispute,
  openDispute,
  replyDispute,
  resolveDispute,
  setDisputeStatus,
} from "./disputes-db.server";
import { readDisputes } from "./disputes-read.server";
import { acceptMission, confirmOrder, placeOrder } from "./market-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_disputes_test";

describe.skipIf(!adminUrl)("litiges (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let otherRestaurantId: string;
  let driverId: string;
  let adminId: string;
  let financeId: string;
  let orderId: string;
  let missionId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const me = (id: string, role: "restaurant" | "farmer" | "driver" | "admin") => ({ id, role });
  const notified = async (userId: string, title: string) =>
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.title, title)));

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
    // Une administratrice Finance : elle voit les litiges mais ne les tranche pas.
    const [f] = await db
      .insert(users)
      .values({
        role: "admin",
        email: "finance.test@exemple.sn",
        phone: "760000002",
        passwordHash: "x",
        firstName: "Fina",
        lastName: "Nance",
        status: "active",
      })
      .returning();
    financeId = f.id;
    await db.insert(adminProfiles).values({ userId: financeId, adminRole: "finance" });

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
    orderId = placed.orders[0].id;
    await confirmOrder(db, farmerId, orderId, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, orderId));
    missionId = m.id;
    await acceptMission(db, driverId, missionId);
  });

  afterAll(async () => {
    await close?.();
  });

  it("le restaurant ouvre un litige : référence, délai, parties prévenues, pas de doublon", async () => {
    const d = await openDispute(db, me(restaurantId, "restaurant"), {
      orderId,
      category: "quality",
      subcategory: "Produit avarié",
      description: "Deux cagettes de tomates abîmées à l'arrivée, photos prises.",
      againstRole: "farmer",
      claimedAmount: 3000,
      priority: "high",
    });
    expect(d.reference).toBe("LIT-0001");
    const [row] = await db.select().from(disputes).where(eq(disputes.id, d.id));
    expect(row).toMatchObject({ status: "open", againstUserId: farmerId, missionId });
    expect(row.slaDueAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(23 * 3600_000);
    expect(await notified(farmerId, "Litige ouvert vous concernant")).toHaveLength(1);
    expect(await notified(adminId, "Nouveau litige")).toHaveLength(1);
    await expect(
      openDispute(db, me(restaurantId, "restaurant"), {
        orderId,
        category: "quality",
        subcategory: "Produit avarié",
        description: "Encore une fois le même problème sur la commande.",
        againstRole: "farmer",
        claimedAmount: 1000,
        priority: "low",
      }),
    ).rejects.toThrow(/déjà ouvert/);
    // Jamais sur la commande d'un autre, jamais plus que la commande.
    await expect(
      openDispute(db, me(otherRestaurantId, "restaurant"), {
        orderId,
        category: "quality",
        subcategory: "Produit avarié",
        description: "Je tente un litige sur une commande qui n'est pas à moi.",
        againstRole: "farmer",
        claimedAmount: 1000,
        priority: "low",
      }),
    ).rejects.toThrow(/introuvable/);
  });

  it("échanges : réponse demandée, la partie répond, note interne invisible", async () => {
    const [d] = await db.select().from(disputes).where(eq(disputes.reference, "LIT-0001"));
    await setDisputeStatus(db, adminId, d.id, "awaiting_response");
    expect(await notified(farmerId, "Votre réponse est attendue · LIT-0001")).toHaveLength(1);
    await replyDispute(db, me(farmerId, "farmer"), d.id, {
      text: "Les tomates étaient fermes au départ, le livreur a mis du temps.",
    });
    expect((await db.select().from(disputes).where(eq(disputes.id, d.id)))[0].status).toBe(
      "investigating",
    );
    await replyDispute(db, me(adminId, "admin"), d.id, {
      text: "Note interne : vérifier les photos du livreur.",
      internal: true,
    });
    await expect(
      replyDispute(db, me(otherRestaurantId, "restaurant"), d.id, { text: "Intrus" }),
    ).rejects.toThrow(/introuvable/);
    await expect(
      replyDispute(db, me(financeId, "admin"), d.id, { text: "Finance" }),
    ).rejects.toThrow(/rôle/);

    const forResto = (await readDisputes(db, me(restaurantId, "restaurant"))).find(
      (x) => x.id === d.id,
    )!;
    expect(forResto.messages.map((m) => m.text)).not.toContain(
      "Note interne : vérifier les photos du livreur.",
    );
    expect(forResto.againstName).toBe("Ferme Diallo");
    const forAdmin = (await readDisputes(db, me(adminId, "admin"))).find((x) => x.id === d.id)!;
    expect(forAdmin.messages.some((m) => m.internal)).toBe(true);
    expect(forResto.events.some((e) => e.label === "Litige ouvert")).toBe(true);
  });

  it("instruction : assignation et escalade", async () => {
    const [d] = await db.select().from(disputes).where(eq(disputes.reference, "LIT-0001"));
    await assignDispute(db, adminId, d.id, adminId);
    await expect(assignDispute(db, adminId, d.id, financeId)).rejects.toThrow(/ne traite pas/);
    await escalateDispute(db, adminId, d.id, "Délai dépassé");
    const [after] = await db.select().from(disputes).where(eq(disputes.id, d.id));
    expect(after).toMatchObject({ assigneeId: adminId, escalations: 1, priority: "high" });
  });

  it("décision : remboursement du restaurant, repris sur le solde du producteur", async () => {
    const [d] = await db.select().from(disputes).where(eq(disputes.reference, "LIT-0001"));
    await expect(
      resolveDispute(db, financeId, d.id, {
        outcome: "partial",
        grantedAmount: 2000,
        liableParty: "farmer",
        reason: "Photos probantes",
      }),
    ).rejects.toThrow(/rôle/);
    await expect(
      resolveDispute(db, adminId, d.id, {
        outcome: "partial",
        grantedAmount: 5000,
        liableParty: "farmer",
        reason: "Photos probantes",
      }),
    ).rejects.toThrow(/montant réclamé/);
    await resolveDispute(db, adminId, d.id, {
      outcome: "partial",
      grantedAmount: 2000,
      liableParty: "farmer",
      reason: "Photos probantes de deux cagettes abîmées.",
    });
    const [after] = await db.select().from(disputes).where(eq(disputes.id, d.id));
    expect(after).toMatchObject({ status: "resolved", outcome: "partial", grantedAmount: 2000 });
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, after.refundId!));
    expect(refund).toMatchObject({
      source: "dispute",
      amount: 2000,
      bornBy: "farmer",
      status: "pending",
    });
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.refundId, refund.id));
    expect(entries.map((e) => [e.account, e.amount])).toEqual([["farmer", -2000]]);
    expect(await notified(restaurantId, "Décision sur le litige")).toHaveLength(1);
    expect(await notified(farmerId, "Décision sur le litige")).toHaveLength(1);
    await expect(
      replyDispute(db, me(restaurantId, "restaurant"), d.id, { text: "Encore ?" }),
    ).rejects.toThrow(/clos/);
  });

  it("le livreur ouvre un litige sur sa course : indemnité au grand livre (geste de la plateforme)", async () => {
    await expect(
      openDispute(db, me(driverId, "driver"), {
        category: "delivery",
        subcategory: "Client absent",
        description: "Attente de quarante minutes devant le restaurant fermé.",
        againstRole: "restaurant",
        claimedAmount: 1500,
        priority: "medium",
      }),
    ).rejects.toThrow(/course concernée/);
    const d = await openDispute(db, me(driverId, "driver"), {
      missionId,
      category: "delivery",
      subcategory: "Client absent",
      description: "Attente de quarante minutes devant le restaurant fermé.",
      againstRole: "restaurant",
      claimedAmount: 1500,
      priority: "medium",
    });
    expect(await notified(restaurantId, "Litige ouvert vous concernant")).toHaveLength(1);
    await expect(
      resolveDispute(db, adminId, d.id, {
        outcome: "partial",
        grantedAmount: 1000,
        liableParty: "restaurant",
        reason: "Attente confirmée par l'appel",
      }),
    ).rejects.toThrow(/pas de solde/);
    await resolveDispute(db, adminId, d.id, {
      outcome: "goodwill",
      grantedAmount: 1000,
      liableParty: "farmer",
      reason: "Attente confirmée par l'appel au restaurant.",
    });
    const entries = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.note, "Indemnité Litige LIT-0002"));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ account: "driver", userId: driverId, amount: 1000 });
    const [platform] = await db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.note, "Retenue Litige LIT-0002"));
    // Geste commercial : toujours à la charge de la plateforme.
    expect(platform).toMatchObject({ account: "platform", amount: -1000 });
  });

  it("délai : un produit abîmé se signale dans le délai suivant la livraison", async () => {
    await db
      .update(orders)
      .set({ deliveredAt: new Date(Date.now() - 5 * 86_400_000) })
      .where(eq(orders.id, orderId));
    await expect(
      openDispute(db, me(restaurantId, "restaurant"), {
        orderId,
        category: "quantity",
        subcategory: "Poids inférieur",
        description: "Il manquait deux kilos de tomates sur la pesée finale.",
        againstRole: "farmer",
        claimedAmount: 1000,
        priority: "low",
      }),
    ).rejects.toThrow(/dans les 48 h/);
  });
});
