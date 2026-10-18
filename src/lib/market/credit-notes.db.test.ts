// Avoirs en base (tests sur une vraie base PostgreSQL, fichier « .db ») :
// ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  checkouts,
  creditNotes,
  creditNoteUses,
  ledgerEntries,
  notifications,
  orders,
  payments,
  products,
  settings,
} from "@/db/schema";
import { users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { allocate, readCreditNotes } from "./credit-notes-db.server";
import { openDispute, resolveDispute } from "./disputes-db.server";
import { confirmOrder, placeOrder, setOrderStatus } from "./market-db.server";
import { paymentAllowsDelivery } from "./payments-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_credit_notes_test";

describe.skipIf(!adminUrl)("avoirs (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let otherRestaurantId: string;
  let adminId: string;
  let tomatoId: string;
  let creditId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const slot = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 3);
    d.setUTCHours(9, 0, 0, 0);
    return d.toISOString();
  };
  const order = (qty: number, paymentMethod: "Wave" | "Espèces", creditNoteId?: string) =>
    placeOrder(db, restaurantId, {
      lines: [{ productId: tomatoId, qty }],
      deliveryAddress: "Le Baobab, Dakar Plateau",
      slotStart: slot(),
      slotLabel: "Dans 3 jours · 09:00",
      paymentMethod,
      shortagePreference: "partial",
      creditNoteId,
    });
  const note = async () =>
    (await db.select().from(creditNotes).where(eq(creditNotes.id, creditId)))[0];

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
    const [tomato] = await db.select().from(products).where(eq(products.farmerId, farmerId));
    tomatoId = tomato.id;
    await db
      .update(products)
      .set({ stockQty: 1000, status: "active" })
      .where(eq(products.id, tomatoId));
  });

  afterAll(async () => {
    await close?.();
  });

  it("répartition au franc près", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    expect(allocate(500, [0, 10])).toEqual([0, 500]);
  });

  it("litige tranché en avoir : avoir créé, producteur débité, restaurant prévenu", async () => {
    const placed = await order(10, "Espèces");
    await confirmOrder(db, farmerId, placed.orders[0].id, {});
    const d = await openDispute(
      db,
      { id: restaurantId, role: "restaurant" },
      {
        orderId: placed.orders[0].id,
        category: "billing",
        subcategory: "Montant facturé incorrect",
        description: "Le prix appliqué ne correspond pas à celui affiché au catalogue.",
        againstRole: "farmer",
        claimedAmount: 5000,
        priority: "medium",
      },
    );
    await resolveDispute(db, adminId, d.id, {
      outcome: "credit",
      grantedAmount: 4000,
      liableParty: "farmer",
      reason: "Écart de prix confirmé par le producteur.",
    });
    const [c] = await db.select().from(creditNotes).where(eq(creditNotes.disputeId, d.id));
    creditId = c.id;
    expect(c).toMatchObject({
      reference: "AV-0001",
      amount: 4000,
      balance: 4000,
      status: "active",
      bornBy: "farmer",
    });
    const debit = await db
      .select()
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.userId, farmerId), eq(ledgerEntries.amount, -4000)));
    expect(debit).toHaveLength(1);
    expect(debit[0].note).toContain("AV-0001");
    const notif = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, restaurantId), eq(notifications.title, "Avoir disponible")),
      );
    expect(notif).toHaveLength(1);
    // Un avoir ne s'émet que pour un restaurant.
    expect((await readCreditNotes(db, { id: restaurantId, role: "restaurant" }))[0]).toMatchObject({
      reference: "AV-0001",
      amount: 4000,
      status: "issued",
    });
    expect(await readCreditNotes(db, { id: otherRestaurantId, role: "restaurant" })).toHaveLength(
      0,
    );
  });

  it("un autre restaurant ne peut pas utiliser l'avoir", async () => {
    await expect(
      placeOrder(db, otherRestaurantId, {
        lines: [{ productId: tomatoId, qty: 10 }],
        deliveryAddress: "Keur Massar, Dakar",
        slotStart: slot(),
        slotLabel: "Dans 3 jours · 09:00",
        paymentMethod: "Wave",
        shortagePreference: "partial",
        creditNoteId: creditId,
      }),
    ).rejects.toThrow(/Avoir introuvable/);
  });

  it("utilisé au panier : remise sur la commande, paiement réduit, avoir épuisé", async () => {
    const placed = await order(10, "Wave", creditId);
    expect(placed.creditApplied).toBe(4000);
    const [o] = await db.select().from(orders).where(eq(orders.id, placed.orders[0].id));
    expect(o.discount).toBe(4000);
    const [c] = await db.select().from(checkouts).where(eq(checkouts.id, placed.checkoutId));
    expect(c.total).toBe(o.subtotal + o.deliveryFee - 4000);
    const [p] = await db.select().from(payments).where(eq(payments.checkoutId, placed.checkoutId));
    expect(p.amount).toBe(c.total);
    expect(await note()).toMatchObject({ balance: 0, status: "used" });
    await expect(order(10, "Wave", creditId)).rejects.toThrow(/épuisé/);

    // Annulée : l'avoir revient en entier, le paiement suit.
    await setOrderStatus(
      db,
      { id: restaurantId, actor: "restaurant" },
      o.id,
      "cancelled",
      "Erreur",
    );
    expect(await note()).toMatchObject({ balance: 4000, status: "active" });
    const [o2] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(o2.discount).toBe(0);
    const [use] = await db.select().from(creditNoteUses).where(eq(creditNoteUses.orderId, o.id));
    expect(use).toMatchObject({ amount: 4000, restored: 4000 });
  });

  it("panier entièrement couvert : rien à payer, la course peut partir", async () => {
    // Petit panier, minimum par producteur abaissé pour le test.
    await db
      .insert(settings)
      .values({ key: "min_order_per_producer", value: 0 })
      .onConflictDoUpdate({ target: settings.key, set: { value: 0 } });
    // Avoir plus grand que le panier (livraison comprise).
    await db
      .update(creditNotes)
      .set({ amount: 50_000, balance: 50_000 })
      .where(eq(creditNotes.id, creditId));
    const placed = await order(1, "Wave", creditId);
    const [c] = await db.select().from(checkouts).where(eq(checkouts.id, placed.checkoutId));
    expect(c.paymentMode).toBe("credit");
    expect(c.total).toBe(0);
    expect(
      await db.select().from(payments).where(eq(payments.checkoutId, placed.checkoutId)),
    ).toHaveLength(0);
    const [o] = await db.select().from(orders).where(eq(orders.id, placed.orders[0].id));
    expect(await paymentAllowsDelivery(db, o)).toBe(true);
    expect(placed.creditApplied).toBe(c.subtotal + c.deliveryFee);
    expect((await note()).balance).toBe(50_000 - placed.creditApplied);
  });
});
