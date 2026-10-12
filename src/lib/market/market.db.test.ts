// Place de marché sur une vraie base PostgreSQL (comme les autres tests
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  drivers,
  missions,
  notifications,
  orders,
  products,
  stockMovements,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import {
  acceptMission,
  addDeliveryProof,
  confirmOrder,
  missionStep,
  moveStock,
  placeOrder,
  reportReception,
  saveProduct,
  setOrderStatus,
  type PlaceOrderInput,
} from "./market-db.server";
import { readSnapshot } from "./snapshot.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_market_test";

describe.skipIf(!adminUrl)("place de marché (base)", () => {
  let url: string;
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let restaurant2Id: string;
  let driverId: string;
  let driver2Id: string;
  let tomatoes: { id: string; price: number };
  let onions: { id: string; price: number };

  // Créneau valable quelle que soit l'heure du test : après-demain, 7 h.
  const slot = () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 2);
    d.setUTCHours(7, 0, 0, 0);
    return d.toISOString();
  };
  const order = (over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
    lines: [{ productId: tomatoes.id, qty: 10 }],
    deliveryAddress: "Le Baobab, Dakar Plateau",
    slotStart: slot(),
    slotLabel: "Après-demain · 07:00 – 11:00",
    paymentMethod: "Wave",
    shortagePreference: "partial",
    ...over,
  });
  const stockOf = async (id: string) =>
    Number((await db.select().from(products).where(eq(products.id, id)))[0].stockQty);
  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const u = new URL(adminUrl!);
    u.pathname = `/${DB_NAME}`;
    url = u.toString();
    ({ db, close } = createDb(url, { max: 4 }));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
    farmerId = await idOf("agriculteur@diambar.sn");
    restaurantId = await idOf("restaurant@diambar.sn");
    restaurant2Id = await idOf("keurmassar.dib@gmail.com");
    driverId = await idOf("livreur@diambar.sn");
    // Un deuxième livreur actif, pour la course disputée.
    const [d2] = await db
      .insert(users)
      .values({
        role: "driver",
        email: "second.livreur@exemple.sn",
        phone: "760000001",
        passwordHash: "x",
        firstName: "Second",
        lastName: "Livreur",
        status: "active",
      })
      .returning();
    driver2Id = d2.id;
    await db.insert(drivers).values({ userId: driver2Id });
    await db.insert(vehicles).values({ driverId: driver2Id, type: "camionnette", capacityKg: 900 });
    await db.update(vehicles).set({ capacityKg: 900 }).where(eq(vehicles.driverId, driverId));
    // Les restaurants de démo sont actifs pour commander.
    await db.update(users).set({ status: "active" }).where(eq(users.id, restaurant2Id));
    const rows = await db.select().from(products).where(eq(products.farmerId, farmerId));
    const pick = (name: string) => {
      const p = rows.find((r) => r.name.startsWith(name))!;
      return { id: p.id, price: p.price };
    };
    tomatoes = pick("Tomates");
    onions = pick("Oignons");
    await db
      .update(products)
      .set({ status: "active", minOrderQty: null })
      .where(eq(products.farmerId, farmerId));
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("le restaurant voit le catalogue et le producteur, sans brouillon", async () => {
    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    expect(snap.products.length).toBeGreaterThan(0);
    expect(snap.products.every((p) => p.status !== "draft")).toBe(true);
    expect(snap.directory.farmers.some((f) => f.farm === "Ferme Diallo")).toBe(true);
    expect(snap.restaurant?.name).toBe("Le Baobab");
    expect(snap.zones.some((z) => z.name === "Plateau" && z.active)).toBe(true);
  });

  it("deux commandes simultanées sur le dernier stock : une seule passe", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 10 });
    const a = createDb(url);
    const b = createDb(url);
    try {
      const results = await Promise.allSettled([
        placeOrder(a.db, restaurantId, order()),
        placeOrder(b.db, restaurant2Id, order({ deliveryAddress: "Keur Massar, Dakar" })),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled");
      const ko = results.filter((r) => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(ko).toHaveLength(1);
      expect(String((ko[0] as PromiseRejectedResult).reason?.message)).toMatch(/Stock insuffisant/);
      expect(await stockOf(tomatoes.id)).toBe(0);
    } finally {
      await a.close();
      await b.close();
    }
  });

  it("refuse le jour même, sous le minimum et hors zone", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const today = new Date();
    today.setUTCHours(23, 0, 0, 0);
    await expect(
      placeOrder(db, restaurantId, order({ slotStart: today.toISOString() })),
    ).rejects.toThrow(/première livraison possible/);
    await expect(
      placeOrder(db, restaurantId, order({ lines: [{ productId: tomatoes.id, qty: 1 }] })),
    ).rejects.toThrow(/Minimum/);
    await expect(
      placeOrder(db, restaurantId, order({ deliveryAddress: "Quelque part, Ziguinchor" })),
    ).rejects.toThrow(/desservie/);
    expect(await stockOf(tomatoes.id)).toBe(100);
  });

  it("confirmation partielle : stock rendu, course ouverte, restaurant prévenu", async () => {
    await moveStock(db, farmerId, { productId: onions.id, type: "adjust", qty: 50 });
    const placed = await placeOrder(
      db,
      restaurantId,
      order({
        lines: [
          { productId: tomatoes.id, qty: 10 },
          { productId: onions.id, qty: 20 },
        ],
      }),
    );
    expect(placed.orders).toHaveLength(1);
    const o = placed.orders[0];
    expect(o.reference).toMatch(/^CMD-\d+$/);
    expect(await stockOf(onions.id)).toBe(30);
    // Un autre producteur ne peut pas toucher à cette commande.
    await expect(confirmOrder(db, restaurantId, o.id, {})).rejects.toThrow(/introuvable/);

    const res = await confirmOrder(db, farmerId, o.id, { [onions.id]: 15 });
    expect(res.outcome).toBe("adjusted");
    expect(await stockOf(onions.id)).toBe(35);
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(row.status).toBe("confirmed");
    expect(row.subtotal).toBe(10 * tomatoes.price + 15 * onions.price);
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    expect(m.status).toBe("available");
    expect(m.payout).toBeGreaterThan(0);
    expect(Number(m.weightKg)).toBe(25);
    const notes = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, restaurantId), eq(notifications.title, "Quantités ajustées")),
      );
    expect(notes).toHaveLength(1);

    // Les codes ne sont montrés qu'aux bonnes personnes.
    const farmerSnap = await readSnapshot(db, { id: farmerId, role: "farmer" });
    expect(farmerSnap.orders.find((x) => x.id === o.id)?.pickupCode).toMatch(/^\d{4}$/);
    const restoSnap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    const ro = restoSnap.restaurantOrders.find((x) => x.id === o.id)!;
    expect(ro.deliveryCode).toMatch(/^\d{4}$/);
    expect(restoSnap.orders).toHaveLength(0);
    const driverSnap = await readSnapshot(db, { id: driverId, role: "driver" });
    const seen = driverSnap.missions.find((x) => x.id === m.id);
    expect(seen?.status).toBe("available");
    expect(driverSnap.orders.find((x) => x.id === o.id)?.pickupCode).toBeUndefined();
  });

  it("course disputée, codes vérifiés, photo exigée, commande livrée", async () => {
    const placed = await placeOrder(db, restaurantId, order());
    const o = placed.orders[0];
    await confirmOrder(db, farmerId, o.id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    const a = createDb(url);
    const b = createDb(url);
    try {
      const results = await Promise.allSettled([
        acceptMission(a.db, driverId, m.id),
        acceptMission(b.db, driver2Id, m.id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    } finally {
      await a.close();
      await b.close();
    }
    const [taken] = await db.select().from(missions).where(eq(missions.id, m.id));
    const winner = taken.driverId!;
    const loser = winner === driverId ? driver2Id : driverId;
    await expect(missionStep(db, loser, m.id, "loaded", "0000")).rejects.toThrow(/attribuée/);

    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    const wrong = (c: string) => String((Number(c) + 1) % 10000).padStart(4, "0");
    await expect(missionStep(db, winner, m.id, "loaded", wrong(row.pickupCode))).rejects.toThrow(
      /Code d'enlèvement incorrect/,
    );
    await missionStep(db, winner, m.id, "loaded", row.pickupCode);
    expect((await db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe(
      "delivering",
    );

    await expect(missionStep(db, winner, m.id, "delivered", row.deliveryCode)).rejects.toThrow(
      /photo/,
    );
    await addDeliveryProof(db, winner, {
      missionId: m.id,
      stage: "dropoff",
      storageKey: "non-conserve/test.jpg",
      mime: "image/jpeg",
      size: 1000,
    });
    await expect(
      missionStep(db, winner, m.id, "delivered", wrong(row.deliveryCode)),
    ).rejects.toThrow(/Code de remise incorrect/);
    await missionStep(db, winner, m.id, "delivered", row.deliveryCode);
    const [done] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(done.status).toBe("delivered");
    expect(done.deliveredWithCode).toBe(true);
    expect(done.receptionDeadline!.getTime()).toBeGreaterThan(Date.now() + 47 * 3600_000);
    // Une course livrée ne change plus (elle ne paie qu'une fois).
    await expect(missionStep(db, winner, m.id, "delivered", row.deliveryCode)).rejects.toThrow(
      /déjà livrée/,
    );

    await reportReception(db, restaurantId, o.id, {
      lines: [{ productId: tomatoes.id, refusedQty: 2, reason: "Abîmées" }],
    });
    await expect(reportReception(db, restaurantId, o.id, { lines: [] })).rejects.toThrow(
      /déjà été contrôlée/,
    );
    const restoSnap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    const ro = restoSnap.restaurantOrders.find((x) => x.id === o.id)!;
    expect(ro.reception?.refundedAmount).toBe(2 * tomatoes.price);
    expect(ro.statusHistory.map((h) => h.status)).toEqual([
      "pending",
      "confirmed",
      "delivering",
      "delivered",
    ]);
  });

  it("annulation par le restaurant : stock remis, enlèvement interdit ensuite", async () => {
    const before = await stockOf(tomatoes.id);
    const placed = await placeOrder(db, restaurantId, order());
    const o = placed.orders[0];
    expect(await stockOf(tomatoes.id)).toBe(before - 10);
    await setOrderStatus(
      db,
      { id: restaurantId, actor: "restaurant" },
      o.id,
      "cancelled",
      "Erreur",
    );
    expect(await stockOf(tomatoes.id)).toBe(before);
    const moves = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.orderId, o.id), eq(stockMovements.reason, "order_cancelled")));
    expect(moves).toHaveLength(1);
    await expect(
      setOrderStatus(db, { id: farmerId, actor: "farmer" }, o.id, "confirmed"),
    ).rejects.toThrow(/ne peut plus changer/);
  });

  it("le producteur crée et modifie un produit, chaque écart de stock est tracé", async () => {
    const id = await saveProduct(db, farmerId, {
      name: "Piment rouge",
      category: "Épices",
      price: 1500,
      unit: "kg",
      stock: 12,
      minStock: 3,
      organic: false,
      paused: false,
      draft: false,
    });
    await saveProduct(db, farmerId, {
      id,
      name: "Piment rouge",
      category: "Épices",
      price: 1600,
      unit: "kg",
      stock: 9,
      minStock: 3,
      organic: true,
      paused: true,
      draft: false,
    });
    const [p] = await db.select().from(products).where(eq(products.id, id));
    expect(p.price).toBe(1600);
    expect(p.status).toBe("paused");
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, id));
    expect(moves.map((m) => Number(m.delta)).sort()).toEqual([-3, 12]);
    await expect(
      saveProduct(db, restaurantId, {
        id,
        name: "Vol",
        category: "Épices",
        price: 1,
        unit: "kg",
        stock: 0,
        minStock: 0,
        organic: false,
        paused: false,
        draft: false,
      }),
    ).rejects.toThrow(/introuvable/);
    // Hors saison : invisible à la commande.
    await expect(
      placeOrder(db, restaurantId, order({ lines: [{ productId: id, qty: 5 }] })),
    ).rejects.toThrow(/hors saison/);
  });
});
