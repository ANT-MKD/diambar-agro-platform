// Commandes récurrentes en base (tests sur une vraie base PostgreSQL, fichier
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  checkouts,
  notifications,
  orders,
  products,
  recurringOrderEvents,
  recurringOrders,
  settings,
  users,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { addDaysIso, isBusinessDate, isoDate } from "@/lib/recurring-engine";
import type { RecurringInput } from "./recurring-db.server";
import {
  cancelRecurringOrder,
  createRecurringOrder,
  overrideNextRecurringDelivery,
  pauseRecurringOrder,
  resolveRecurringPending,
  resumeRecurringOrder,
  runDueRecurringOrders,
  skipNextRecurringDelivery,
  updateRecurringOrder,
} from "./recurring-db.server";
import { readSnapshot } from "./snapshot.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_recurring_test";

describe.skipIf(!adminUrl)("commandes récurrentes (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let tomatoes: { id: string; price: number };
  let onions: { id: string; price: number };

  const today = () => isoDate(Date.now());
  // Livraison dans 3 jours au moins, un jour ouvré : faisable quelle que
  // soit l'heure (et le jour) du test.
  const inDays = (n: number) => addDaysIso(today(), n);
  const firstOpen = (() => {
    let n = 3;
    while (!isBusinessDate(addDaysIso(isoDate(Date.now()), n))) n++;
    return n;
  })();
  const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
  const input = (over: Partial<RecurringInput> = {}): RecurringInput => ({
    name: "Légumes de la semaine",
    farmerId,
    items: [
      { productId: tomatoes.id, qty: 10 },
      { productId: onions.id, qty: 10 },
    ],
    frequency: "weekly",
    daysOfWeek: [weekday(inDays(firstOpen))],
    deliveryTime: "09:30",
    orderTime: "08:00",
    firstDeliveryOn: inDays(firstOpen),
    end: { type: "never" },
    rules: {
      priceIncreaseThresholdPct: 10,
      onPriceIncrease: "ask_confirmation",
      onOutOfStock: "cancel_item",
      maxBudget: 1_000_000,
      onBudgetExceeded: "ask_confirmation",
      onNonBusinessDay: "ask_confirmation",
    },
    deliveryAddress: "Le Baobab, Dakar Plateau",
    paymentMethod: "Wave",
    shortagePreference: "partial",
    ...over,
  });
  const rec = async (id: string) =>
    (await db.select().from(recurringOrders).where(eq(recurringOrders.id, id)))[0];
  const eventsOf = async (id: string) =>
    (
      await db
        .select()
        .from(recurringOrderEvents)
        .where(eq(recurringOrderEvents.recurringOrderId, id))
    ).map((e) => `${e.kind}: ${e.message}`);
  const ordersOf = async (id: string) =>
    db.select().from(orders).where(eq(orders.recurringOrderId, id));
  /** Rend l'échéance prévue exigible tout de suite (heure posée par la base,
   * à la microseconde, comme en production). */
  const makeDue = async (id: string) =>
    db
      .update(recurringOrders)
      .set({ nextRunAt: sql`now() - interval '1 minute'` })
      .where(eq(recurringOrders.id, id));
  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;

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
    const rows = await db.select().from(products).where(eq(products.farmerId, farmerId));
    const pick = (name: string) => {
      const p = rows.find((r) => r.name.startsWith(name))!;
      return { id: p.id, price: p.price };
    };
    tomatoes = pick("Tomates");
    onions = pick("Oignons");
    await db
      .update(products)
      .set({ stockQty: 500, status: "active" })
      .where(eq(products.farmerId, farmerId));
  });

  afterAll(async () => {
    await close?.();
  });

  it("création : prochaine livraison et moment de la commande (la veille, à l'heure dite)", async () => {
    await expect(
      createRecurringOrder(db, restaurantId, input({ orderTime: "19:00" })),
    ).rejects.toThrow(/heure limite/);
    await expect(
      createRecurringOrder(db, restaurantId, input({ deliveryTime: "22:00" })),
    ).rejects.toThrow(/entre 06:00 et 20:00/);
    await expect(createRecurringOrder(db, restaurantId, input({ daysOfWeek: [] }))).rejects.toThrow(
      /au moins un jour/,
    );
    const id = await createRecurringOrder(db, restaurantId, input());
    const r = await rec(id);
    expect(r.nextDeliveryOn).toBe(inDays(firstOpen));
    expect(r.nextRunAt?.toISOString()).toBe(`${inDays(firstOpen - 1)}T08:00:00.000Z`);
    expect(r.status).toBe("active");
    const items = r.items as { productId: string; referencePrice: number }[];
    expect(items.find((i) => i.productId === tomatoes.id)?.referencePrice).toBe(tomatoes.price);
    expect((await eventsOf(id))[0]).toMatch(/created: .*première livraison/);
    await cancelRecurringOrder(db, restaurantId, id);
  });

  it("passage automatique : commande passée une seule fois, à l'heure de livraison choisie", async () => {
    const id = await createRecurringOrder(db, restaurantId, input());
    await makeDue(id);
    const [a, b] = await Promise.all([runDueRecurringOrders(db), runDueRecurringOrders(db)]);
    expect(a + b).toBe(1);
    const placed = await ordersOf(id);
    expect(placed).toHaveLength(1);
    const [ck] = await db.select().from(checkouts).where(eq(checkouts.id, placed[0].checkoutId));
    expect(ck.slotStart.toISOString()).toBe(`${inDays(firstOpen)}T09:30:00.000Z`);
    const r = await rec(id);
    expect(r.generatedCount).toBe(1);
    expect(r.nextDeliveryOn).toBe(inDays(firstOpen + 7));
    expect((await eventsOf(id)).some((e) => /generated: Commande CMD-\d+ passée/.test(e))).toBe(
      true,
    );
    const told = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, restaurantId),
          eq(notifications.title, "Commande récurrente passée · Légumes de la semaine"),
        ),
      );
    expect(told).toHaveLength(1);
    expect(told[0].body).toMatch(/à payer par Wave/);
    // Rien de plus au passage suivant.
    expect(await runDueRecurringOrders(db)).toBe(0);
    // L'instantané du restaurant montre la récurrence et sa commande.
    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    const shown = snap.recurringOrders.find((x) => x.id === id);
    expect(shown?.generatedOrderIds).toEqual([placed[0].id]);
    expect(shown?.nextDeliveryOn).toBe(inDays(firstOpen + 7));
    expect(shown?.deliverySlot).toBe("09:30");
    await cancelRecurringOrder(db, restaurantId, id);
  });

  it("hausse de prix : le restaurant tranche, puis la commande part", async () => {
    const id = await createRecurringOrder(db, restaurantId, input({ name: "Prix" }));
    await db
      .update(products)
      .set({ price: Math.round(tomatoes.price * 1.5) })
      .where(eq(products.id, tomatoes.id));
    await makeDue(id);
    await runDueRecurringOrders(db);
    let r = await rec(id);
    expect(r.status).toBe("problem");
    expect(r.pendingAction).toMatchObject({ kind: "price_increase" });
    expect(await ordersOf(id)).toHaveLength(0);
    const alert = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, restaurantId),
          eq(notifications.title, "Action requise · Prix"),
        ),
      );
    expect(alert).toHaveLength(1);
    expect(await resolveRecurringPending(db, restaurantId, id, "confirm")).toBe("ordered");
    await expect(resolveRecurringPending(db, restaurantId, id, "confirm")).rejects.toThrow(
      /Aucune décision/,
    );
    r = await rec(id);
    expect(r.status).toBe("active");
    expect(await ordersOf(id)).toHaveLength(1);
    await db.update(products).set({ price: tomatoes.price }).where(eq(products.id, tomatoes.id));
    await cancelRecurringOrder(db, restaurantId, id);
  });

  it("rupture : la ligne manquante est retirée (règle « retirer l'article »)", async () => {
    const id = await createRecurringOrder(db, restaurantId, input({ name: "Rupture" }));
    await db.update(products).set({ stockQty: 0 }).where(eq(products.id, onions.id));
    await makeDue(id);
    await runDueRecurringOrders(db);
    const placed = await ordersOf(id);
    expect(placed).toHaveLength(1);
    expect(placed[0].subtotal).toBe(10 * tomatoes.price);
    expect((await eventsOf(id)).some((e) => /Retiré de la commande \(rupture\)/.test(e))).toBe(
      true,
    );
    await db.update(products).set({ stockQty: 500 }).where(eq(products.id, onions.id));
    await cancelRecurringOrder(db, restaurantId, id);
  });

  it("sauter, modifier la prochaine livraison, pause et reprise", async () => {
    const id = await createRecurringOrder(db, restaurantId, input({ name: "Gestion" }));
    await skipNextRecurringDelivery(db, restaurantId, id, "Fermeture");
    let r = await rec(id);
    expect(r.nextDeliveryOn).toBe(inDays(firstOpen + 7));
    expect((await eventsOf(id)).some((e) => /sautée \(Fermeture\)/.test(e))).toBe(true);

    await overrideNextRecurringDelivery(db, restaurantId, id, [
      { productId: tomatoes.id, qty: 12 },
    ]);
    await updateRecurringOrder(db, restaurantId, id, { name: "Gestion modifiée" });
    // La date de la prochaine livraison est ramenée à après-demain + 1 pour
    // passer la commande tout de suite avec les quantités modifiées.
    await db
      .update(recurringOrders)
      .set({ nextDeliveryOn: inDays(firstOpen), nextRunAt: new Date(Date.now() - 60_000) })
      .where(eq(recurringOrders.id, id));
    await db
      .update(recurringOrders)
      .set({
        exceptions: [
          {
            id: "x",
            type: "override",
            occurrenceDate: inDays(firstOpen),
            items: [{ productId: tomatoes.id, qty: 12, referencePrice: tomatoes.price }],
            createdAt: new Date().toISOString(),
          },
        ],
      })
      .where(eq(recurringOrders.id, id));
    await runDueRecurringOrders(db);
    const placed = await ordersOf(id);
    expect(placed).toHaveLength(1);
    expect(placed[0].subtotal).toBe(12 * tomatoes.price);

    await pauseRecurringOrder(db, restaurantId, id, "Vacances");
    r = await rec(id);
    expect(r.status).toBe("paused");
    expect(r.nextRunAt).toBeNull();
    await resumeRecurringOrder(db, restaurantId, id);
    r = await rec(id);
    expect(r.status).toBe("active");
    expect(r.nextDeliveryOn).not.toBeNull();
    await cancelRecurringOrder(db, restaurantId, id);
    expect((await rec(id)).status).toBe("ended");
  });

  it("échéance manquée : pas de commande hors délai, la suivante est prévue", async () => {
    const id = await createRecurringOrder(db, restaurantId, input({ name: "Manquée" }));
    await db
      .update(recurringOrders)
      .set({ nextDeliveryOn: today(), nextRunAt: new Date(Date.now() - 60_000) })
      .where(eq(recurringOrders.id, id));
    await runDueRecurringOrders(db);
    expect(await ordersOf(id)).toHaveLength(0);
    expect((await eventsOf(id)).some((e) => /manquée/.test(e))).toBe(true);
    expect((await rec(id)).nextDeliveryOn! > today()).toBe(true);
    await cancelRecurringOrder(db, restaurantId, id);
  });

  it("un restaurant ne touche pas aux récurrences d'un autre", async () => {
    const id = await createRecurringOrder(db, restaurantId, input({ name: "Privée" }));
    const other = await idOf("keurmassar.dib@gmail.com");
    await expect(pauseRecurringOrder(db, other, id, "x")).rejects.toThrow(/introuvable/);
    await cancelRecurringOrder(db, restaurantId, id);
  });
});
