// Tests du schéma sur une vraie base PostgreSQL.
// Ils ne tournent que si TEST_DATABASE_URL est défini (adresse d'un serveur
// PostgreSQL local, avec un compte autorisé à créer des bases) :
//   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:db
// Une base « diambar_schema_test » est recréée de zéro à chaque lancement.
import { compareSync } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client.server.ts";
import {
  categories,
  checkouts,
  farmers,
  invoices,
  ledgerEntries,
  missions,
  orderItems,
  orders,
  payments,
  products,
  refunds,
  restaurants,
  settings,
  users,
} from "./schema.ts";
import { seedDemo, seedReference } from "./seed.ts";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_schema_test";

/** Vérifie qu'une écriture est refusée par la base (contrainte, doublon…). */
async function rejects(fn: () => Promise<unknown>) {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  expect(failed, "la base aurait dû refuser cette écriture").toBe(true);
}

describe.skipIf(!adminUrl)("schéma de la base", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const url = new URL(adminUrl!);
    url.pathname = `/${DB_NAME}`;
    ({ db, close } = createDb(url.toString()));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("crée les 44 tables du pilote, toutes verrouillées (RLS)", async () => {
    const rows = await db.execute<{ tablename: string; rowsecurity: boolean }>(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );
    expect(rows.length).toBe(44);
    expect(rows.filter((r) => !r.rowsecurity).map((r) => r.tablename)).toEqual([]);
  });

  it("remplit les référentiels et les comptes de démo", async () => {
    expect((await db.select().from(categories)).length).toBe(7);
    // 5 réglages de référence + inscriptions ouvertes et configuration faite (démo)
    expect((await db.select().from(settings)).length).toBe(8);
    const demoUsers = await db.select().from(users);
    expect(demoUsers.length).toBe(8);
    const farmer = demoUsers.find((u) => u.email === "agriculteur@diambar.sn")!;
    expect(farmer.passwordHash.startsWith("$2")).toBe(true);
    expect(farmer.passwordHash).not.toContain("demo1234");
    expect(compareSync("demo1234", farmer.passwordHash)).toBe(true);
    expect(demoUsers.find((u) => u.email === "awa.camara@gmail.com")?.status).toBe("pending");
    expect((await db.select().from(products)).length).toBe(4);
  });

  it("peut relancer les données de départ sans doublon", async () => {
    await seedReference(db);
    await seedDemo(db);
    expect((await db.select().from(users)).length).toBe(8);
    expect((await db.select().from(products)).length).toBe(4);
    expect((await db.select().from(categories)).length).toBe(7);
  });

  it("refuse les comptes en double ou mal formés", async () => {
    const base = {
      role: "restaurant" as const,
      passwordHash: "$2a$10$x",
      firstName: "Test",
      lastName: "Test",
    };
    await rejects(() => db.insert(users).values({ ...base, email: "agriculteur@diambar.sn" }));
    await rejects(() => db.insert(users).values({ ...base, email: "Majuscule@exemple.sn" }));
    await rejects(() =>
      db.insert(users).values({ ...base, email: "a@exemple.sn", phone: "+221771234567" }),
    );
    await rejects(() =>
      db.insert(users).values({ ...base, email: "b@exemple.sn", phone: "771234567" }),
    );
  });

  it("refuse les montants incohérents", async () => {
    const [restaurant] = await db.select().from(restaurants).limit(1);
    const [product] = await db.select().from(products).limit(1);
    await rejects(() =>
      db.update(products).set({ price: -100 }).where(eq(products.id, product.id)),
    );
    await rejects(() =>
      db.insert(checkouts).values({
        reference: "PAN-ERR",
        restaurantId: restaurant.userId,
        slotStart: new Date(),
        deliveryAddress: "Plateau",
        paymentMode: "prepaid",
        subtotal: 10_000,
        deliveryFee: 1_000,
        total: 9_000,
      }),
    );
  });

  it("enregistre une commande complète et protège ses règles", async () => {
    const [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.name, "Le Baobab"));
    const [farmer] = await db.select().from(farmers).where(eq(farmers.farmName, "Ferme Diallo"));
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.farmerId, farmer.userId))
      .limit(1);
    const admins = await db.select().from(users).where(eq(users.role, "admin"));

    const [checkout] = await db
      .insert(checkouts)
      .values({
        reference: "PAN-0001",
        restaurantId: restaurant.userId,
        slotStart: new Date("2026-10-12T07:00:00Z"),
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMode: "prepaid",
        subtotal: 17_000,
        deliveryFee: 1_500,
        total: 18_500,
      })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        reference: "CMD-0001",
        checkoutId: checkout.id,
        restaurantId: restaurant.userId,
        farmerId: farmer.userId,
        trackingToken: "jeton-test-0001",
        pickupCode: "1234",
        deliveryCode: "5678",
        subtotal: 17_000,
      })
      .returning();
    await db.insert(orderItems).values({
      orderId: order.id,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      unitPrice: 850,
      qtyOrdered: 20,
    });
    // Quantité refusée supérieure à la quantité livrée : refusé.
    await rejects(() =>
      db.insert(orderItems).values({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        unitPrice: 850,
        qtyOrdered: 2,
        qtyRefused: 3,
      }),
    );

    // Une seule mission par commande ; pas de mission acceptée sans livreur.
    await db.insert(missions).values({
      reference: "MIS-0001",
      orderId: order.id,
      scheduledFor: new Date("2026-10-12T06:00:00Z"),
      payout: 2_000,
    });
    await rejects(() =>
      db.insert(missions).values({
        reference: "MIS-0002",
        orderId: order.id,
        scheduledFor: new Date(),
        payout: 2_000,
      }),
    );
    await rejects(() =>
      db.update(missions).set({ status: "accepted" }).where(eq(missions.orderId, order.id)),
    );

    // Paiement confirmé sans date : refusé ; avec date : accepté.
    await rejects(() =>
      db
        .insert(payments)
        .values({ checkoutId: checkout.id, method: "wave", amount: 18_500, status: "confirmed" }),
    );
    await db.insert(payments).values({
      checkoutId: checkout.id,
      method: "wave",
      amount: 18_500,
      status: "confirmed",
      paidAt: new Date(),
      confirmedBy: admins[0].id,
    });

    // Grand livre : la plateforme n'a pas de titulaire, un producteur en a un.
    await db.insert(ledgerEntries).values([
      { account: "farmer", userId: farmer.userId, kind: "sale", amount: 14_450, orderId: order.id },
      { account: "platform", kind: "commission", amount: 2_550, orderId: order.id },
    ]);
    await rejects(() =>
      db
        .insert(ledgerEntries)
        .values({ account: "platform", userId: farmer.userId, kind: "commission", amount: 1 }),
    );
    await rejects(() =>
      db.insert(ledgerEntries).values({ account: "farmer", kind: "sale", amount: 1 }),
    );
    const [balance] = await db.execute<{ total: string }>(
      sql`select sum(amount) as total from ledger_entries where user_id = ${farmer.userId}`,
    );
    expect(Number(balance.total)).toBe(14_450);

    // Un même admin ne crée pas et n'approuve pas le même remboursement.
    await rejects(() =>
      db.insert(refunds).values({
        reference: "RMB-0001",
        orderId: order.id,
        source: "reception",
        amount: 1_700,
        createdBy: admins[0].id,
        approvedBy: admins[0].id,
      }),
    );

    // Facture : TTC = HT + TVA ; une seule facture par panier.
    await db.insert(invoices).values({
      number: "FAC-2026-0001",
      checkoutId: checkout.id,
      totalHt: 18_500,
      totalTtc: 18_500,
    });
    await rejects(() =>
      db.insert(invoices).values({
        number: "FAC-2026-0002",
        checkoutId: checkout.id,
        totalHt: 18_500,
        totalTtc: 18_500,
      }),
    );
    await rejects(() =>
      db
        .insert(invoices)
        .values({ number: "FAC-2026-0003", checkoutId: checkout.id, totalHt: 100, totalTtc: 90 }),
    );
  });
});
