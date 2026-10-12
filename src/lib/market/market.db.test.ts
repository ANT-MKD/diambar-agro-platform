// Place de marché sur une vraie base PostgreSQL (comme les autres tests
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq, isNull, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  drivers,
  ledgerEntries,
  missions,
  notifications,
  orders,
  payments,
  payouts,
  products,
  refunds,
  settings,
  stockMovements,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import {
  acceptMission,
  addDeliveryProof,
  confirmOrder,
  confirmPayment,
  missionStep,
  moveStock,
  placeOrder,
  reportReception,
  saveProduct,
  setOrderStatus,
  type PlaceOrderInput,
} from "./market-db.server";
import { declarePayment, rejectPayment } from "./payments-db.server";
import { payPayout, payRefund, rejectPayout, requestPayout } from "./payouts-db.server";
import { readBalances } from "./ledger-db.server";
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
  let adminId: string;
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
  // Paiement Wave du panier (orderId vide) ; espèces : un par commande.
  const checkoutPaymentOf = async (checkoutId: string) =>
    (
      await db
        .select()
        .from(payments)
        .where(and(eq(payments.checkoutId, checkoutId), isNull(payments.orderId)))
    )[0];
  let refCounter = 0;
  const newRef = () => `T_TEST${Date.now().toString(36).toUpperCase()}${++refCounter}`;
  /** Le restaurant paie par Wave et l'admin confirme. */
  const pay = async (checkoutId: string) => {
    await declarePayment(db, restaurantId, { checkoutId, method: "wave", providerRef: newRef() });
    await confirmPayment(db, adminId, (await checkoutPaymentOf(checkoutId)).id);
  };

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
    adminId = await idOf("admin@diambar.sn");
    // Numéro marchand de test (base locale uniquement) et espèces ouvertes.
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
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: {
            wave: { enabled: true, number: "770000000" },
            orangeMoney: { enabled: false, number: "" },
            cashOnDelivery: { enabled: true },
          },
        },
      });
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
    // Le restaurant paie tout de suite le panier entier.
    await declarePayment(db, restaurantId, {
      checkoutId: placed.checkoutId,
      method: "wave",
      providerRef: newRef(),
    });
    // Un autre producteur ne peut pas toucher à cette commande.
    await expect(confirmOrder(db, restaurantId, o.id, {})).rejects.toThrow(/introuvable/);

    const res = await confirmOrder(db, farmerId, o.id, { [onions.id]: 15 });
    expect(res.outcome).toBe("adjusted");
    expect(await stockOf(onions.id)).toBe(35);
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(row.status).toBe("confirmed");
    expect(row.subtotal).toBe(10 * tomatoes.price + 15 * onions.price);
    // Pas de course tant que le paiement n'est pas confirmé, ni de préparation.
    expect(await db.select().from(missions).where(eq(missions.orderId, o.id))).toHaveLength(0);
    await expect(
      setOrderStatus(db, { id: farmerId, actor: "farmer" }, o.id, "preparing"),
    ).rejects.toThrow(/pas encore payé/);
    const farmerWaiting = await readSnapshot(db, { id: farmerId, role: "farmer" });
    expect(farmerWaiting.orders.find((x) => x.id === o.id)?.awaitingPayment).toBe(true);
    // L'admin confirme : la course s'ouvre et les 5 oignons manquants
    // deviennent un remboursement.
    await confirmPayment(db, adminId, (await checkoutPaymentOf(placed.checkoutId)).id);
    const owed = await db.select().from(refunds).where(eq(refunds.orderId, o.id));
    expect(owed).toHaveLength(1);
    expect(owed[0].source).toBe("shortage");
    expect(owed[0].amount).toBe(5 * onions.price);
    expect(owed[0].reference).toMatch(/^REM-\d+$/);
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
    expect(ro.payment?.state).toBe("paid");
    expect(ro.paid).toBe(true);
    expect(ro.refunds?.map((r) => r.amount)).toEqual([5 * onions.price]);
    expect(restoSnap.rules.merchant?.wave).toBe("770000000");
    const driverSnap = await readSnapshot(db, { id: driverId, role: "driver" });
    const seen = driverSnap.missions.find((x) => x.id === m.id);
    expect(seen?.status).toBe("available");
    expect(driverSnap.orders.find((x) => x.id === o.id)?.pickupCode).toBeUndefined();
  });

  it("course disputée, codes vérifiés, photo exigée, commande livrée", async () => {
    const placed = await placeOrder(db, restaurantId, order());
    const o = placed.orders[0];
    await confirmOrder(db, farmerId, o.id, {});
    await pay(placed.checkoutId);
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

  it("paiement Wave : référence refusée, déclarée à nouveau, jamais réutilisable", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const first = await placeOrder(db, restaurantId, order());
    const second = await placeOrder(db, restaurantId, order());
    const wrongRef = newRef();
    await declarePayment(db, restaurantId, {
      checkoutId: first.checkoutId,
      method: "wave",
      providerRef: wrongRef,
    });
    // Un autre restaurant ne peut pas déclarer pour ce panier.
    await expect(
      declarePayment(db, restaurant2Id, {
        checkoutId: first.checkoutId,
        method: "wave",
        providerRef: newRef(),
      }),
    ).rejects.toThrow(/introuvable/);
    // Orange Money n'est pas ouvert dans les réglages de test.
    await expect(
      declarePayment(db, restaurantId, {
        checkoutId: second.checkoutId,
        method: "orange_money",
        providerRef: newRef(),
      }),
    ).rejects.toThrow(/pas proposé/);
    // La même référence ne paie pas deux paniers.
    await expect(
      declarePayment(db, restaurantId, {
        checkoutId: second.checkoutId,
        method: "wave",
        providerRef: wrongRef.toLowerCase(),
      }),
    ).rejects.toThrow(/déjà été déclarée/);

    const p = await checkoutPaymentOf(first.checkoutId);
    expect(p.status).toBe("pending");
    expect(p.amount).toBe(first.total);
    await rejectPayment(db, adminId, p.id, "Aucune transaction avec cette référence");
    let snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    let ro = snap.restaurantOrders.find((x) => x.id === first.orders[0].id)!;
    expect(ro.payment?.state).toBe("refused");
    expect(ro.payment?.note).toMatch(/Aucune transaction/);

    // Le restaurant corrige ; l'admin voit le paiement à vérifier et confirme.
    await declarePayment(db, restaurantId, {
      checkoutId: first.checkoutId,
      method: "wave",
      providerRef: newRef(),
    });
    const adminSnap = await readSnapshot(db, { id: adminId, role: "admin" });
    const seen = adminSnap.payments?.find((x) => x.id === p.id);
    expect(seen?.state).toBe("declared");
    expect(seen?.restaurantName).toBe("Le Baobab");
    await confirmPayment(db, adminId, p.id);
    await expect(confirmPayment(db, adminId, p.id)).rejects.toThrow(/déjà confirmé/);
    snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    ro = snap.restaurantOrders.find((x) => x.id === first.orders[0].id)!;
    expect(ro.payment?.state).toBe("paid");

    // Payé avant la confirmation du producteur : la course s'ouvre dès qu'il confirme.
    await confirmOrder(db, farmerId, first.orders[0].id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, first.orders[0].id));
    expect(m.status).toBe("available");

    // Annulée après paiement : tout le panier est à rembourser.
    await setOrderStatus(
      db,
      { id: farmerId, actor: "farmer" },
      first.orders[0].id,
      "cancelled",
      "Récolte perdue",
    );
    const back = await db.select().from(refunds).where(eq(refunds.orderId, first.orders[0].id));
    expect(back).toHaveLength(1);
    expect(back[0].source).toBe("cancellation");
    expect(back[0].amount).toBe(first.total);

    // Annulé avant tout paiement : plus rien à payer, aucun remboursement.
    await setOrderStatus(
      db,
      { id: restaurantId, actor: "restaurant" },
      second.orders[0].id,
      "cancelled",
      "Erreur",
    );
    expect((await checkoutPaymentOf(second.checkoutId)).status).toBe("cancelled");
    expect(
      await db.select().from(refunds).where(eq(refunds.orderId, second.orders[0].id)),
    ).toHaveLength(0);
  });

  it("espèces : la course part sans attendre, le livreur encaisse, l'admin récupère", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const placed = await placeOrder(db, restaurantId, order({ paymentMethod: "Espèces" }));
    const o = placed.orders[0];
    const [cash] = await db.select().from(payments).where(eq(payments.orderId, o.id));
    expect(cash.method).toBe("cash");
    expect(cash.amount).toBe(placed.total);
    await expect(
      declarePayment(db, restaurantId, {
        checkoutId: placed.checkoutId,
        method: "wave",
        providerRef: newRef(),
      }),
    ).rejects.toThrow(/espèces/);

    await confirmOrder(db, farmerId, o.id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    expect(m.status).toBe("available");
    await acceptMission(db, driverId, m.id);
    const driverSnap = await readSnapshot(db, { id: driverId, role: "driver" });
    expect(driverSnap.missions.find((x) => x.id === m.id)?.cashToCollect).toBe(placed.total);
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    await missionStep(db, driverId, m.id, "loaded", row.pickupCode);
    await addDeliveryProof(db, driverId, {
      missionId: m.id,
      stage: "dropoff",
      storageKey: "non-conserve/especes.jpg",
      mime: "image/jpeg",
      size: 1000,
    });
    // Le livreur doit confirmer avoir encaissé.
    await expect(missionStep(db, driverId, m.id, "delivered", row.deliveryCode)).rejects.toThrow(
      /encaissé/,
    );
    // L'admin ne peut pas confirmer des espèces pas encore encaissées.
    await expect(confirmPayment(db, adminId, cash.id)).rejects.toThrow(/pas encore encaissé/);
    await missionStep(db, driverId, m.id, "delivered", row.deliveryCode, true);
    const [collected] = await db.select().from(payments).where(eq(payments.id, cash.id));
    expect(collected.collectedBy).toBe(driverId);
    const adminSnap = await readSnapshot(db, { id: adminId, role: "admin" });
    const seen = adminSnap.payments?.find((x) => x.id === cash.id);
    expect(seen?.state).toBe("collected");
    expect(seen?.collectedBy?.id).toBe(driverId);
    await confirmPayment(db, adminId, cash.id);
    const [paid] = await db.select().from(payments).where(eq(payments.id, cash.id));
    expect(paid.status).toBe("confirmed");
    expect(paid.confirmedBy).toBe(adminId);
  });

  it("grand livre à la livraison, refus à la réception, retraits et remboursements", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const before = (await readBalances(db, [farmerId, driverId]))!;
    const farmerBefore = before.get(farmerId)!.balance;
    const driverBefore = before.get(driverId)!.balance;
    const placed = await placeOrder(
      db,
      restaurantId,
      order({ lines: [{ productId: tomatoes.id, qty: 20 }] }),
    );
    const o = placed.orders[0];
    await confirmOrder(db, farmerId, o.id, {});
    await pay(placed.checkoutId);
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    await acceptMission(db, driverId, m.id);
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    await missionStep(db, driverId, m.id, "loaded", row.pickupCode);
    await addDeliveryProof(db, driverId, {
      missionId: m.id,
      stage: "dropoff",
      storageKey: "non-conserve/livre.jpg",
      mime: "image/jpeg",
      size: 1000,
    });
    await missionStep(db, driverId, m.id, "delivered", row.deliveryCode);

    // Ce que le restaurant a payé est exactement réparti entre les trois comptes.
    const entries = await db.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, o.id));
    const sum = (f: (e: (typeof entries)[number]) => boolean) =>
      entries.filter(f).reduce((acc, e) => acc + e.amount, 0);
    const subtotal = 20 * tomatoes.price;
    const farmerCommission = Math.round(subtotal * 0.15);
    expect(sum((e) => e.account === "farmer" && e.kind === "sale")).toBe(subtotal);
    expect(sum((e) => e.account === "farmer" && e.kind === "commission")).toBe(-farmerCommission);
    expect(sum((e) => e.account === "driver" && e.kind === "driver_payout")).toBe(m.payout);
    expect(sum((e) => e.account === "driver" && e.kind === "commission")).toBe(
      -Math.round(m.payout * 0.2),
    );
    expect(sum(() => true)).toBe(row.subtotal + row.deliveryFee);
    const after = await readBalances(db, [farmerId, driverId]);
    expect(after.get(farmerId)!.balance - farmerBefore).toBe(subtotal - farmerCommission);
    expect(after.get(driverId)!.balance - driverBefore).toBe(m.payout - Math.round(m.payout * 0.2));

    // Livrer une deuxième fois n'écrit rien de plus.
    await expect(missionStep(db, driverId, m.id, "delivered", row.deliveryCode)).rejects.toThrow();
    expect(
      await db.select().from(ledgerEntries).where(eq(ledgerEntries.orderId, o.id)),
    ).toHaveLength(entries.length);

    // Refus à la réception : remboursement au restaurant, repris sur le producteur.
    await reportReception(db, restaurantId, o.id, {
      lines: [{ productId: tomatoes.id, refusedQty: 4, reason: "Abîmées" }],
    });
    const [refund] = await db
      .select()
      .from(refunds)
      .where(and(eq(refunds.orderId, o.id), eq(refunds.source, "reception")));
    expect(refund.amount).toBe(4 * tomatoes.price);
    expect(refund.bornBy).toBe("farmer");
    const back = Math.round((farmerCommission * 4 * tomatoes.price) / subtotal);
    const afterRefusal = (await readBalances(db, [farmerId])).get(farmerId)!;
    expect(afterRefusal.balance).toBe(after.get(farmerId)!.balance - 4 * tomatoes.price + back);
    const farmerSnap = await readSnapshot(db, { id: farmerId, role: "farmer" });
    const credited = farmerSnap.wallet!.transactions.filter((t) => t.orderRef === o.reference);
    expect(credited.map((t) => t.kind).sort()).toEqual(["delivery", "refund_adjustment"]);
    expect(credited.find((t) => t.kind === "delivery")!.net).toBe(subtotal - farmerCommission);

    // L'admin rembourse le restaurant.
    await expect(
      payRefund(db, adminId, refund.id, { method: "wave", paidTo: "771234567", providerRef: "x" }),
    ).rejects.toThrow(/Référence invalide/);
    await payRefund(db, adminId, refund.id, {
      method: "wave",
      paidTo: "77 123 45 67",
      providerRef: newRef(),
    });
    await expect(
      payRefund(db, adminId, refund.id, {
        method: "wave",
        paidTo: "771234567",
        providerRef: newRef(),
      }),
    ).rejects.toThrow(/déjà fait/);
    const restoSnap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    expect(
      restoSnap.restaurantOrders
        .find((x) => x.id === o.id)
        ?.refunds?.find((r) => r.id === refund.id)?.status,
    ).toBe("paid");

    // Retraits du producteur : jamais plus que le disponible, même en parallèle.
    const available = afterRefusal.available;
    await expect(
      requestPayout(db, farmerId, { amount: available + 1, method: "wave" }),
    ).rejects.toThrow(/insuffisant/);
    await expect(requestPayout(db, farmerId, { amount: 500, method: "wave" })).rejects.toThrow(
      /minimum/,
    );
    const half = Math.floor(available / 2);
    const a = createDb(url);
    const b = createDb(url);
    try {
      const results = await Promise.allSettled([
        requestPayout(a.db, farmerId, { amount: available - 1000, method: "wave" }),
        requestPayout(b.db, farmerId, { amount: available - 1000, method: "wave" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    } finally {
      await a.close();
      await b.close();
    }
    const [first] = await db
      .select()
      .from(payouts)
      .where(and(eq(payouts.userId, farmerId), eq(payouts.status, "requested")));
    expect(first.reference).toMatch(/^VER-\d+$/);
    expect(first.accountNumber).toMatch(/^7\d{8}$/);
    expect((await readBalances(db, [farmerId])).get(farmerId)!.available).toBe(1000);
    await rejectPayout(db, adminId, first.id, "Numéro à vérifier avec vous");
    expect((await readBalances(db, [farmerId])).get(farmerId)!.available).toBe(available);
    await requestPayout(db, farmerId, {
      amount: half,
      method: "orange_money",
      accountNumber: "78 111 22 33",
    });
    const [second] = await db
      .select()
      .from(payouts)
      .where(and(eq(payouts.userId, farmerId), eq(payouts.status, "requested")));
    await payPayout(db, adminId, second.id, newRef());
    await expect(payPayout(db, adminId, second.id, newRef())).rejects.toThrow(/plus à verser/);
    const finalBalance = (await readBalances(db, [farmerId])).get(farmerId)!;
    expect(finalBalance.balance).toBe(afterRefusal.balance - half);
    expect(finalBalance.available).toBe(available - half);
    const farmerAfter = await readSnapshot(db, { id: farmerId, role: "farmer" });
    expect(farmerAfter.wallet!.withdrawals.map((w) => w.status).sort()).toEqual(
      expect.arrayContaining(["Effectué", "Échec"]),
    );

    // Le livreur voit ses gains et retire.
    const driverSnap = await readSnapshot(db, { id: driverId, role: "driver" });
    expect(driverSnap.driverWallet!.balance).toBe(
      (await readBalances(db, [driverId])).get(driverId)!.available,
    );
    expect(driverSnap.driverWallet!.transactions.some((t) => t.ref === m.reference)).toBe(true);
    await requestPayout(db, driverId, { amount: 1000, method: "wave" });
    const adminSnap = await readSnapshot(db, { id: adminId, role: "admin" });
    expect(adminSnap.payouts?.some((p) => p.userId === driverId && p.status === "requested")).toBe(
      true,
    );
    expect(adminSnap.accounts?.find((x) => x.userId === farmerId)?.balance).toBe(
      finalBalance.balance,
    );
    expect(adminSnap.refunds?.some((r) => r.id === refund.id && r.status === "paid")).toBe(true);
    // Le grand livre reste équilibré : sommes jamais modifiées, seulement ajoutées.
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.kind, "payout"));
    expect(n).toBe(1);
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
