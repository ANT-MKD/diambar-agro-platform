// Place de marché sur une vraie base PostgreSQL (comme les autres tests
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq, isNull, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  auditLogs,
  categories,
  cities,
  drivers,
  farmers,
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
  zones,
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
  quoteCheckoutDelivery,
  reportReception,
  saveProduct,
  setOrderStatus,
  sweepUnpaidCheckouts,
  type PlaceOrderInput,
} from "./market-db.server";
import { declarePayment, rejectPayment } from "./payments-db.server";
import { approveCategory, mergeCategory, renameCategory, renameUnit } from "./catalog-db.server";
import {
  approvePayout,
  approveRefund,
  payPayout,
  payRefund,
  rejectPayout,
  requestPayout,
} from "./payouts-db.server";
import { issueDueInvoices, readStatement } from "./documents-db.server";
import { readBalances } from "./ledger-db.server";
import { paymentDeadline } from "@/lib/payment-deadline";
import { DEFAULT_DELIVERY_PRICING, deliveryFee, driverNetCost } from "@/lib/delivery-pricing";
import { missionPayout } from "@/lib/mission-pay";
import { checkouts, invoices } from "@/db/schema";
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
    const p = await checkoutPaymentOf(checkoutId);
    await confirmPayment(db, adminId, p.id, undefined, p.amount);
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
    await db.insert(drivers).values({ userId: driver2Id, isOnline: true });
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

  it("refuse le jour même, hors des heures de livraison, sous le minimum et hors zone", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    await expect(
      placeOrder(db, restaurantId, order({ slotStart: today.toISOString() })),
    ).rejects.toThrow(/jour même|après-demain/);
    const night = new Date(slot());
    night.setUTCHours(22, 30, 0, 0);
    await expect(
      placeOrder(db, restaurantId, order({ slotStart: night.toISOString() })),
    ).rejects.toThrow(/entre 06:00 et 20:00/);
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
    const declared = await checkoutPaymentOf(placed.checkoutId);
    await confirmPayment(db, adminId, declared.id, undefined, declared.amount);
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
    // Montant différent de ce qui est dû : refusé.
    await expect(confirmPayment(db, adminId, p.id, undefined, first.total - 1)).rejects.toThrow(
      /Montant différent/,
    );
    await confirmPayment(db, adminId, p.id, undefined, first.total);
    await expect(confirmPayment(db, adminId, p.id, undefined, first.total)).rejects.toThrow(
      /déjà confirmé/,
    );
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
    await expect(confirmPayment(db, adminId, cash.id, undefined, cash.amount)).rejects.toThrow(
      /pas encore encaissé/,
    );
    await missionStep(db, driverId, m.id, "delivered", row.deliveryCode, true);
    const [collected] = await db.select().from(payments).where(eq(payments.id, cash.id));
    expect(collected.collectedBy).toBe(driverId);
    const adminSnap = await readSnapshot(db, { id: adminId, role: "admin" });
    const seen = adminSnap.payments?.find((x) => x.id === cash.id);
    expect(seen?.state).toBe("collected");
    expect(seen?.collectedBy?.id).toBe(driverId);
    await expect(
      confirmPayment(db, adminId, cash.id, undefined, cash.amount - 500),
    ).rejects.toThrow(/Montant différent/);
    await confirmPayment(db, adminId, cash.id, undefined, cash.amount);
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

  it("non payé à temps : rappel, puis annulation et stock remis ; déclaré : jamais annulé", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const unpaid = await placeOrder(db, restaurantId, order());
    const declared = await placeOrder(db, restaurantId, order());
    await declarePayment(db, restaurantId, {
      checkoutId: declared.checkoutId,
      method: "wave",
      providerRef: newRef(),
    });
    const stockAfterOrders = await stockOf(tomatoes.id);
    const [c] = await db.select().from(checkouts).where(eq(checkouts.id, unpaid.checkoutId));
    const deadline = paymentDeadline(c.createdAt, c.slotStart, 20);
    // Le restaurant voit l'échéance.
    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    expect(snap.restaurantOrders.find((o) => o.id === unpaid.orders[0].id)?.payment?.dueBy).toBe(
      deadline.toISOString(),
    );

    // Une heure avant : un seul rappel, rien d'annulé.
    const soon = new Date(deadline.getTime() - 30 * 60_000);
    await sweepUnpaidCheckouts(db, soon);
    await sweepUnpaidCheckouts(db, soon);
    const reminders = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, restaurantId), eq(notifications.title, "Paiement attendu")),
      );
    expect(reminders.filter((n) => n.body?.includes(c.reference))).toHaveLength(1);
    expect(
      (await db.select().from(orders).where(eq(orders.id, unpaid.orders[0].id)))[0].status,
    ).toBe("pending");

    // Échéance passée : annulée, stock remis ; le panier déclaré reste.
    await sweepUnpaidCheckouts(db, new Date(deadline.getTime() + 60_000));
    const [gone] = await db.select().from(orders).where(eq(orders.id, unpaid.orders[0].id));
    expect(gone.status).toBe("cancelled");
    expect(gone.cancelReason).toBe("Non payée dans le délai");
    expect((await checkoutPaymentOf(unpaid.checkoutId)).status).toBe("cancelled");
    // Les 10 kg reviennent en vente (avec ceux d'autres paniers non payés des
    // tests précédents, annulés eux aussi).
    expect(await stockOf(tomatoes.id)).toBeGreaterThanOrEqual(stockAfterOrders + 10);
    const back = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.orderId, unpaid.orders[0].id),
          eq(stockMovements.reason, "order_cancelled"),
        ),
      );
    expect(back.map((x) => Number(x.delta))).toEqual([10]);
    const [kept] = await db.select().from(orders).where(eq(orders.id, declared.orders[0].id));
    expect(kept.status).toBe("pending");
    // Déclaré après l'échéance par le restaurant ? Trop tard : panier annulé.
    await expect(
      declarePayment(db, restaurantId, {
        checkoutId: unpaid.checkoutId,
        method: "wave",
        providerRef: newRef(),
      }),
    ).rejects.toThrow(/Plus rien à payer/);
  });

  it("espèces chez le livreur : retenues sur ses retraits, plafond pour accepter", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 200 });
    const setLimit = (driverLimit: number) =>
      db
        .update(settings)
        .set({
          value: {
            wave: { enabled: true, number: "770000000" },
            orangeMoney: { enabled: false, number: "" },
            cashOnDelivery: { enabled: true, driverLimit },
          },
        })
        .where(eq(settings.key, "payment_methods"));
    await setLimit(1_000_000);
    const before = (await readBalances(db, [driverId])).get(driverId)!;
    const placed = await placeOrder(db, restaurantId, order({ paymentMethod: "Espèces" }));
    const o = placed.orders[0];
    await confirmOrder(db, farmerId, o.id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    await acceptMission(db, driverId, m.id);
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    await missionStep(db, driverId, m.id, "loaded", row.pickupCode);
    await addDeliveryProof(db, driverId, {
      missionId: m.id,
      stage: "dropoff",
      storageKey: "non-conserve/cash.jpg",
      mime: "image/jpeg",
      size: 1000,
    });
    await missionStep(db, driverId, m.id, "delivered", row.deliveryCode, true);
    const held = (await readBalances(db, [driverId])).get(driverId)!;
    expect(held.cashHeld).toBe(placed.total);
    // Le gain de la course est crédité, mais les espèces sont retenues.
    expect(held.available).toBe(Math.max(0, held.balance - held.reserved - placed.total));
    expect(held.balance).toBeGreaterThan(before.balance);
    const driverSnap = await readSnapshot(db, { id: driverId, role: "driver" });
    expect(driverSnap.driverWallet?.cashHeld).toBe(placed.total);
    if (held.balance - held.reserved > held.available) {
      await expect(
        requestPayout(db, driverId, {
          amount: held.balance - held.reserved,
          method: "wave",
        }),
      ).rejects.toThrow(/espèces encaissées sont à remettre/);
    }

    // Plafond : avec déjà ces espèces en poche, pas de nouvelle course en espèces.
    await setLimit(placed.total + 1000);
    const next = await placeOrder(db, restaurantId, order({ paymentMethod: "Espèces" }));
    await confirmOrder(db, farmerId, next.orders[0].id, {});
    const [m2] = await db.select().from(missions).where(eq(missions.orderId, next.orders[0].id));
    await expect(acceptMission(db, driverId, m2.id)).rejects.toThrow(/Remettez vos espèces/);
    // Une fois l'argent remis à l'admin, il peut accepter.
    const [cashRow] = await db.select().from(payments).where(eq(payments.orderId, o.id));
    await confirmPayment(db, adminId, cashRow.id, undefined, cashRow.amount);
    await acceptMission(db, driverId, m2.id);
    expect((await readBalances(db, [driverId])).get(driverId)!.cashHeld).toBe(0);
    await setLimit(50_000);
  });

  /** Commande Wave payée, confirmée, livrée par le livreur de démo. */
  const deliveredOrder = async (qty: number) => {
    const placed = await placeOrder(
      db,
      restaurantId,
      order({ lines: [{ productId: tomatoes.id, qty }] }),
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
      storageKey: `non-conserve/facture-${o.id}.jpg`,
      mime: "image/jpeg",
      size: 1000,
    });
    await missionStep(db, driverId, m.id, "delivered", row.deliveryCode);
    return { placed, o: (await db.select().from(orders).where(eq(orders.id, o.id)))[0] };
  };

  it("factures : émises après la réception, quantités acceptées, numéros sans trou", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 200 });
    // Factures des paniers des tests précédents, pour partir d'un état connu.
    await issueDueInvoices(db, new Date(Date.now() + 72 * 3600_000));
    const a = await deliveredOrder(12);
    const b = await deliveredOrder(8);
    // Livrées mais contrôle de réception pas fait : pas encore de facture.
    await issueDueInvoices(db);
    expect(
      await db.select().from(invoices).where(eq(invoices.checkoutId, a.placed.checkoutId)),
    ).toHaveLength(0);
    // Le restaurant refuse 2 kg sur A : la facture porte 10 kg.
    await reportReception(db, restaurantId, a.o.id, {
      lines: [{ productId: tomatoes.id, refusedQty: 2, reason: "Abîmées" }],
    });
    expect(await issueDueInvoices(db)).toBe(1);
    expect(await issueDueInvoices(db)).toBe(0);
    const [fa] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.checkoutId, a.placed.checkoutId));
    expect(fa.number).toMatch(/^FAC-\d{4}-\d{5}$/);
    expect(fa.totalTtc).toBe(10 * tomatoes.price + a.o.deliveryFee);
    expect(fa.totalHt + fa.tvaAmount).toBe(fa.totalTtc);
    const content = fa.content as { lines: { qty: number }[]; payment: { refunded: number } };
    expect(content.lines.map((l) => l.qty)).toEqual([10]);
    expect(content.payment.refunded).toBe(2 * tomatoes.price);
    // B : délai de réclamation passé sans contrôle → facturée, numéro suivant.
    expect(await issueDueInvoices(db, new Date(Date.now() + 49 * 3600_000))).toBe(1);
    const [fb] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.checkoutId, b.placed.checkoutId));
    expect(Number(fb.number.slice(-5))).toBe(Number(fa.number.slice(-5)) + 1);
    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    expect(snap.invoices?.map((i) => i.number)).toEqual(
      expect.arrayContaining([fa.number, fb.number]),
    );
  });

  it("relevé mensuel : solde d'ouverture, mouvements, solde de clôture = solde du compte", async () => {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const st = await readStatement(db, farmerId, month);
    const balance = (await readBalances(db, [farmerId])).get(farmerId)!.balance;
    expect(st.opening).toBe(0);
    expect(st.closing).toBe(balance);
    expect(st.credits + st.debits).toBe(balance);
    expect(st.lines.some((l) => l.label.startsWith("Vente"))).toBe(true);
    expect(st.lines.some((l) => l.label.startsWith("Retrait versé"))).toBe(true);
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const later = await readStatement(
      db,
      farmerId,
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    expect(later.opening).toBe(balance);
    expect(later.lines).toHaveLength(0);
    await expect(readStatement(db, restaurantId, month)).rejects.toThrow(/introuvable/);
  });

  it("double validation au-dessus du seuil : un admin valide, un autre envoie", async () => {
    const financeId = await idOf("finance@diambar.sn");
    await db
      .update(settings)
      .set({
        value: {
          wave: { enabled: true, number: "770000000" },
          orangeMoney: { enabled: false, number: "" },
          cashOnDelivery: { enabled: true, driverLimit: 50_000 },
          approvalThreshold: 2000,
        },
      })
      .where(eq(settings.key, "payment_methods"));

    // Retrait de 2 000 : deux administrateurs.
    await requestPayout(db, farmerId, { amount: 2000, method: "wave" });
    const [big] = await db
      .select()
      .from(payouts)
      .where(and(eq(payouts.userId, farmerId), eq(payouts.status, "requested")));
    await expect(payPayout(db, adminId, big.id, newRef())).rejects.toThrow(
      /premier administrateur/,
    );
    await approvePayout(db, adminId, big.id);
    await expect(payPayout(db, adminId, big.id, newRef())).rejects.toThrow(/Vous avez validé/);
    await payPayout(db, financeId, big.id, newRef());
    const [done] = await db.select().from(payouts).where(eq(payouts.id, big.id));
    expect(done.status).toBe("paid");
    expect(done.approvedBy).toBe(adminId);
    expect(done.processedBy).toBe(financeId);
    // Retrait sous le seuil : un seul administrateur suffit.
    await requestPayout(db, farmerId, { amount: 1000, method: "wave" });
    const [small] = await db
      .select()
      .from(payouts)
      .where(and(eq(payouts.userId, farmerId), eq(payouts.status, "requested")));
    await expect(approvePayout(db, adminId, small.id)).rejects.toThrow(/pas besoin/);
    await payPayout(db, adminId, small.id, newRef());

    // Remboursement (annulation après paiement) : même règle.
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const placed = await placeOrder(db, restaurantId, order());
    await pay(placed.checkoutId);
    await setOrderStatus(
      db,
      { id: restaurantId, actor: "restaurant" },
      placed.orders[0].id,
      "cancelled",
      "Erreur de commande",
    );
    const [r] = await db.select().from(refunds).where(eq(refunds.orderId, placed.orders[0].id));
    const refundInput = () => ({
      method: "wave" as const,
      paidTo: "771234567",
      providerRef: newRef(),
    });
    await expect(payRefund(db, adminId, r.id, refundInput())).rejects.toThrow(
      /premier administrateur/,
    );
    await approveRefund(db, adminId, r.id);
    await expect(payRefund(db, adminId, r.id, refundInput())).rejects.toThrow(/Vous avez validé/);
    await payRefund(db, financeId, r.id, refundInput());
    const [paidRefund] = await db.select().from(refunds).where(eq(refunds.id, r.id));
    expect(paidRefund.status).toBe("paid");
    expect(paidRefund.approvedBy).toBe(adminId);
    expect(paidRefund.paidBy).toBe(financeId);
    const adminSnap = await readSnapshot(db, { id: adminId, role: "admin" });
    expect(adminSnap.payouts?.find((x) => x.id === big.id)?.approvedByName).toBeTruthy();
    expect(adminSnap.payouts?.find((x) => x.id === big.id)?.needsTwoAdmins).toBe(true);
  });

  it("frais selon la distance : devis = commande, même distance pour le livreur, lieu inconnu bloqué", async () => {
    await moveStock(db, farmerId, { productId: tomatoes.id, type: "adjust", qty: 100 });
    const lines = [{ productId: tomatoes.id, qty: 10 }];
    const quoteFor = (deliveryAddress = "Le Baobab, Dakar Plateau") =>
      quoteCheckoutDelivery(db, restaurantId, { deliveryAddress, lines });

    // Ferme Diallo (route de Khombole, Thiès) → Plateau : environ 74 km.
    const quote = await quoteFor();
    expect(quote.deliveries).toHaveLength(1);
    const q = quote.deliveries[0];
    expect(q.origin).toBe("Thiès");
    expect(q.distanceKm).toBeGreaterThanOrEqual(65);
    expect(q.distanceKm).toBeLessThanOrEqual(85);
    expect(q.fee).toBe(deliveryFee(q.distanceKm, 10, DEFAULT_DELIVERY_PRICING).fee);
    expect(q.fee).toBeGreaterThanOrEqual(driverNetCost(q.distanceKm, 10));
    expect(quote.total).toBe(q.fee);

    // La commande reprend exactement le devis, et la course la même distance.
    const placed = await placeOrder(db, restaurantId, order({ lines }));
    const o = placed.orders[0];
    const [row] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(row.deliveryFee).toBe(q.fee);
    expect(Number(row.distanceKm)).toBe(q.distanceKm);
    const due = await checkoutPaymentOf(placed.checkoutId);
    expect(due.amount).toBe(10 * tomatoes.price + q.fee);
    await pay(placed.checkoutId);
    await confirmOrder(db, farmerId, o.id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, o.id));
    expect(Number(m.distanceKm)).toBe(q.distanceKm);
    expect(m.payout).toBe(missionPayout(q.distanceKm, 10));

    // Correction par producteur (piste absente de la carte) : +5 km.
    await db.update(farmers).set({ distanceAdjustKm: 5 }).where(eq(farmers.userId, farmerId));
    expect((await quoteFor()).deliveries[0].distanceKm).toBe(q.distanceKm + 5);
    await db.update(farmers).set({ distanceAdjustKm: 0 }).where(eq(farmers.userId, farmerId));

    // Barème réglé par l'admin : appliqué au devis suivant.
    await db.insert(settings).values({
      key: "delivery_pricing",
      value: { ...DEFAULT_DELIVERY_PRICING, brackets: [{ upToKm: 200, fee: 20_000 }] },
    });
    expect((await quoteFor()).total).toBe(20_000);
    await db.delete(settings).where(eq(settings.key, "delivery_pricing"));

    // Producteur sans lieu de collecte reconnu : bloqué, l'équipe prévenue
    // une seule fois, rien n'est réservé.
    const [f] = await db.select().from(farmers).where(eq(farmers.userId, farmerId));
    await db
      .update(farmers)
      .set({ pickupAddress: "Lieu-dit sans nom", zoneId: null, lat: null, lng: null })
      .where(eq(farmers.userId, farmerId));
    await expect(quoteFor()).rejects.toThrow(/lieu de collecte .* pas encore localisé/);
    await expect(quoteFor()).rejects.toThrow(/pas encore localisé/);
    const stock = await stockOf(tomatoes.id);
    await expect(placeOrder(db, restaurantId, order({ lines }))).rejects.toThrow(
      /pas encore localisé/,
    );
    expect(await stockOf(tomatoes.id)).toBe(stock);
    const alerts = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, adminId), eq(notifications.title, "Lieu à localiser")));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].link).toBe("/admin/delivery-pricing");
    // Position exacte réglée par l'admin : la commande repart.
    await db
      .update(farmers)
      .set({ lat: 14.7886, lng: -16.9246 })
      .where(eq(farmers.userId, farmerId));
    expect((await quoteFor()).deliveries[0].origin).toBe("Position du producteur");
    await db
      .update(farmers)
      .set({ pickupAddress: f.pickupAddress, zoneId: f.zoneId, lat: f.lat, lng: f.lng })
      .where(eq(farmers.userId, farmerId));

    // Nouveau quartier sans position : jamais placé au centre de sa ville.
    const [dakar] = await db.select().from(cities).where(eq(cities.name, "Dakar"));
    const [nz] = await db
      .insert(zones)
      .values({ cityId: dakar.id, name: "Quartier Nouveau" })
      .returning();
    await expect(quoteFor("Chez Awa, Quartier Nouveau, Dakar")).rejects.toThrow(
      /Le quartier Quartier Nouveau n'est pas encore localisé/,
    );
    await db.update(zones).set({ lat: 14.75, lng: -17.4 }).where(eq(zones.id, nz.id));
    expect((await quoteFor("Chez Awa, Quartier Nouveau, Dakar")).zone).toBe("Quartier Nouveau");
    await db.update(zones).set({ active: false }).where(eq(zones.id, nz.id));
  });

  it("catégories : proposée par un producteur, reprise si elle existe, renommée, fusionnée", async () => {
    const product = (name: string, category: string) =>
      saveProduct(db, farmerId, {
        name,
        category,
        price: 2000,
        unit: "kg",
        stock: 5,
        minStock: 1,
        organic: false,
        paused: false,
        draft: false,
      });
    const catOf = async (productId: string) =>
      (
        await db
          .select({
            name: categories.name,
            status: categories.status,
            createdBy: categories.createdBy,
          })
          .from(products)
          .innerJoin(categories, eq(categories.id, products.categoryId))
          .where(eq(products.id, productId))
      )[0];

    // Écrite autrement : la catégorie existante est reprise, rien n'est créé.
    const before = (await db.select().from(categories)).length;
    const carrots = await product("Carottes nouvelles", "  legume ");
    expect((await catOf(carrots)).name).toBe("Légumes");
    expect((await db.select().from(categories)).length).toBe(before);

    // Nouvelle : créée tout de suite, proposée, l'équipe prévenue.
    const mushrooms = await product("Pleurotes", "champignons");
    const proposed = await catOf(mushrooms);
    expect(proposed).toMatchObject({
      name: "Champignons",
      status: "proposed",
      createdBy: farmerId,
    });
    const alerts = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, adminId),
          eq(notifications.title, "Nouvelle catégorie proposée"),
        ),
      );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain("Champignons");
    // Un deuxième produit dans la même catégorie (au pluriel près) la reprend.
    const shiitake = await product("Shiitakés", "Champignon");
    expect((await catOf(shiitake)).name).toBe("Champignons");
    // Nom refusé.
    await expect(product("Bizarre", "<b>")).rejects.toThrow(/lettres/);

    // Le marché voit la catégorie et ses produits.
    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    const listed = snap.categories.find((c) => c.name === "Champignons");
    expect(listed).toMatchObject({ status: "proposed", productCount: 2 });
    expect(listed?.proposedBy).toBe("Ferme Diallo");

    // Renommer : pas vers un nom qui double une autre catégorie.
    const [cat] = await db.select().from(categories).where(eq(categories.name, "Champignons"));
    await expect(renameCategory(db, adminId, cat.id, "légumes")).rejects.toThrow(/existe déjà/);
    await renameCategory(db, adminId, cat.id, "champignons frais");
    expect((await catOf(mushrooms)).name).toBe("Champignons frais");
    await approveCategory(db, adminId, cat.id);
    expect((await catOf(mushrooms)).status).toBe("approved");

    // Fusionner : les produits passent dans l'autre catégorie, le producteur est prévenu.
    const [vegetables] = await db.select().from(categories).where(eq(categories.name, "Légumes"));
    expect(await mergeCategory(db, adminId, cat.id, vegetables.id)).toBe(2);
    expect((await catOf(mushrooms)).name).toBe("Légumes");
    expect(await db.select().from(categories).where(eq(categories.id, cat.id))).toHaveLength(0);
    const told = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, farmerId), eq(notifications.title, "Catégorie regroupée")),
      );
    expect(told).toHaveLength(1);
    const audits = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.targetType, "category"));
    expect(audits.map((a) => a.action).sort()).toEqual([
      "Catégorie gardée",
      "Catégorie renommée",
      "Catégories fusionnées",
    ]);
  });

  it("unités : une unité libre, reprise si elle existe, renommée ou regroupée par l'équipe", async () => {
    const product = (name: string, unit: string) =>
      saveProduct(db, farmerId, {
        name,
        category: "Légumes",
        price: 1000,
        unit,
        stock: 5,
        minStock: 1,
        organic: false,
        paused: false,
        draft: false,
      });
    const unitOf = async (id: string) =>
      (await db.select({ unit: products.unit }).from(products).where(eq(products.id, id)))[0].unit;

    // Écrite autrement qu'une unité de base : celle-ci est reprise.
    expect(await unitOf(await product("Oignons en sac", " Sacs "))).toBe("sac");
    // Unité libre, nettoyée ; la même au pluriel la reprend.
    const a = await product("Gombo", "Seau");
    const b = await product("Piment", "seaux");
    expect([await unitOf(a), await unitOf(b)]).toEqual(["seau", "seau"]);
    const c = await product("Aubergines", "panier");
    await expect(product("Bizarre", "<b>")).rejects.toThrow(/lettres/);

    const snap = await readSnapshot(db, { id: restaurantId, role: "restaurant" });
    expect(snap.units.find((u) => u.name === "seau")?.productCount).toBe(2);

    // Renommer, puis regrouper avec une unité existante.
    expect(await renameUnit(db, adminId, "panier", "Panier 5 kg")).toBe(1);
    expect(await unitOf(c)).toBe("panier 5 kg");
    expect(await renameUnit(db, adminId, "panier 5 kg", "seaux")).toBe(1);
    expect(await unitOf(c)).toBe("seau");
    await expect(renameUnit(db, adminId, "inconnue", "kg")).rejects.toThrow(/Aucun produit/);
    const audits = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.targetType, "unit"));
    expect(audits.map((x) => x.action).sort()).toEqual(["Unité renommée", "Unités fusionnées"]);
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
