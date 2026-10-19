// Avis, retours, incidents, modération et statut des comptes en base (tests
// sur une vraie base PostgreSQL, fichier « .db ») : ne tourne que si
// TEST_DATABASE_URL est défini.
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  adminProfiles,
  creditNotes,
  disputes,
  ledgerEntries,
  missions,
  orders,
  products,
  refunds,
  returnRequests,
  settings,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import { setAccountStatus } from "./accounts-admin-db.server";
import {
  commentIncident,
  createIncident,
  escalateIncident,
  readIncidents,
  refundRestaurantForIncident,
  resolveIncident,
} from "./incidents-db.server";
import { acceptMission, confirmOrder, placeOrder } from "./market-db.server";
import { moderateProduct, readModeration, reportProduct } from "./moderation-db.server";
import {
  advanceReturnPickup,
  closeReturn,
  createReturn,
  creditReturn,
  escalateReturn,
  farmerDecideReturn,
  inspectReturn,
  readReturns,
  replyReturn,
  resolveReturn,
  scheduleReturnPickup,
} from "./returns-db.server";
import { createReview, readReviews, replyReview, setReviewHidden } from "./reviews-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_after_sales_test";

describe.skipIf(!adminUrl)("après-vente (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let otherRestaurantId: string;
  let driverId: string;
  let adminId: string;
  let financeId: string;
  let tomatoId: string;
  const orderIds: string[] = [];
  const missionIds: string[] = [];

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const me = (id: string, role: "restaurant" | "farmer" | "driver" | "admin") => ({ id, role });
  const balance = async (userId: string | null) => {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int` })
      .from(ledgerEntries)
      .where(userId ? eq(ledgerEntries.userId, userId) : eq(ledgerEntries.account, "platform"));
    return Number(row.total);
  };

  /** Commande livrée (livraison simulée : la preuve n'est pas le sujet ici). */
  async function deliveredOrder(qty = 10) {
    const slot = new Date();
    slot.setUTCDate(slot.getUTCDate() + 3);
    slot.setUTCHours(9, 0, 0, 0);
    const placed = await placeOrder(db, restaurantId, {
      lines: [{ productId: tomatoId, qty }],
      deliveryAddress: "Le Baobab, Dakar Plateau",
      slotStart: slot.toISOString(),
      slotLabel: "Dans 3 jours · 09:00",
      paymentMethod: "Espèces",
      shortagePreference: "partial",
    });
    const orderId = placed.orders[0].id;
    await confirmOrder(db, farmerId, orderId, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, orderId));
    await acceptMission(db, driverId, m.id);
    await db.update(missions).set({ status: "delivered" }).where(eq(missions.id, m.id));
    await db
      .update(orders)
      .set({ status: "delivered", deliveredAt: new Date() })
      .where(eq(orders.id, orderId));
    orderIds.push(orderId);
    missionIds.push(m.id);
    return { orderId, missionId: m.id };
  }

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
    const [f] = await db
      .insert(users)
      .values({
        role: "admin",
        email: "finance.apres@exemple.sn",
        phone: "760000022",
        passwordHash: "x",
        firstName: "Fina",
        lastName: "Nance",
        status: "active",
      })
      .returning();
    financeId = f.id;
    await db.insert(adminProfiles).values({ userId: financeId, adminRole: "finance" });
    const [tomato] = await db.select().from(products).where(eq(products.farmerId, farmerId));
    tomatoId = tomato.id;
    await db
      .update(products)
      .set({ stockQty: 5000, status: "active" })
      .where(eq(products.id, tomatoId));
  });

  afterAll(async () => {
    await close?.();
  });

  it("avis : un par commande livrée, réponse du producteur, masquage par l'équipe", async () => {
    const { orderId } = await deliveredOrder();
    const scores = {
      quality: 5,
      quantity: 4,
      freshness: 5,
      timeliness: 3,
      packaging: 4,
      communication: 5,
    };
    await expect(
      createReview(db, me(otherRestaurantId, "restaurant"), {
        orderId,
        ...scores,
        comment: "",
        tags: [],
      }),
    ).rejects.toThrow(/introuvable/);
    const id = await createReview(db, me(restaurantId, "restaurant"), {
      orderId,
      ...scores,
      comment: "Très bonnes tomates.",
      tags: ["Produits très frais"],
    });
    await expect(
      createReview(db, me(restaurantId, "restaurant"), {
        orderId,
        ...scores,
        comment: "",
        tags: [],
      }),
    ).rejects.toThrow(/déjà été notée/);
    await replyReview(db, me(farmerId, "farmer"), id, "Merci pour votre confiance !");
    const mine = await readReviews(db, me(restaurantId, "restaurant"));
    expect(mine[0]).toMatchObject({
      comment: "Très bonnes tomates.",
      reply: { text: "Merci pour votre confiance !" },
    });
    expect(mine[0].driverName).toBeTruthy();
    // Un autre restaurant voit la note, pas le commentaire.
    const other = await readReviews(db, me(otherRestaurantId, "restaurant"));
    expect(other[0]).toMatchObject({ quality: 5, comment: "", orderRef: "", restaurantId: "" });
    await setReviewHidden(db, adminId, id, true);
    expect(await readReviews(db, me(farmerId, "farmer"))).toHaveLength(0);
    expect((await readReviews(db, me(adminId, "admin")))[0].hidden).toBe(true);
  });

  it("retour : délai, plafond, acceptation → remboursement à la charge du producteur", async () => {
    const { orderId } = await deliveredOrder(10);
    const [line] = await db.execute<{ unit_price: number }>(
      sql`select unit_price from order_items where order_id = ${orderId}`,
    );
    const lineValue = 10 * Number(line.unit_price);
    await expect(
      createReturn(db, me(restaurantId, "restaurant"), {
        orderId,
        productId: tomatoId,
        qty: 2,
        reason: "quality",
        description: "Tomates trop mûres à la réception.",
        requestedAmount: lineValue + 1,
      }),
    ).rejects.toThrow(/valeur de la ligne/);
    const ret = await createReturn(db, me(restaurantId, "restaurant"), {
      orderId,
      productId: tomatoId,
      qty: 2,
      reason: "quality",
      description: "Tomates trop mûres à la réception.",
      requestedAmount: 1000,
    });
    expect(ret.reference).toBe("RET-0001");
    await expect(
      createReturn(db, me(restaurantId, "restaurant"), {
        orderId,
        productId: tomatoId,
        qty: 1,
        reason: "quality",
        description: "Encore des tomates abîmées.",
        requestedAmount: 500,
      }),
    ).rejects.toThrow(/existe déjà/);
    await replyReturn(db, me(farmerId, "farmer"), ret.id, "Pouvez-vous envoyer une photo ?");
    const farmerBefore = await balance(farmerId);
    await expect(
      farmerDecideReturn(db, me(farmerId, "farmer"), ret.id, { accept: true, amount: 2000 }),
    ).rejects.toThrow(/réclamé/);
    await farmerDecideReturn(db, me(farmerId, "farmer"), ret.id, { accept: true, amount: 800 });
    expect(await balance(farmerId)).toBe(farmerBefore - 800);
    const [row] = await db.select().from(returnRequests).where(eq(returnRequests.id, ret.id));
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, row.refundId!));
    expect(refund).toMatchObject({ source: "return", bornBy: "farmer", amount: 800 });
    const view = (await readReturns(db, me(restaurantId, "restaurant")))[0];
    expect(view).toMatchObject({
      status: "accepted",
      awardedAmount: 800,
      refund: { status: "pending", amount: 800 },
    });
    expect(view.messages[0]).toMatchObject({ authorRole: "farmer" });
    expect(await readReturns(db, me(otherRestaurantId, "restaurant"))).toHaveLength(0);

    // Avoir à la place du remboursement : la retenue reste la même.
    await creditReturn(db, me(farmerId, "farmer"), ret.id);
    expect(await balance(farmerId)).toBe(farmerBefore - 800);
    const [after] = await db.select().from(refunds).where(eq(refunds.id, refund.id));
    expect(after.status).toBe("rejected");
    const [credit] = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.restaurantId, restaurantId));
    expect(credit).toMatchObject({ amount: 800, bornBy: "farmer" });
    expect((await readReturns(db, me(farmerId, "farmer")))[0]).toMatchObject({
      status: "credited",
      creditNoteRef: credit.reference,
    });
    await expect(creditReturn(db, me(farmerId, "farmer"), ret.id)).rejects.toThrow(/déjà/);
  });

  it("retour géré par l'équipe : récupération, inspection, décision, clôture", async () => {
    const { orderId } = await deliveredOrder(10);
    const ret = await createReturn(db, me(restaurantId, "restaurant"), {
      orderId,
      productId: tomatoId,
      qty: 3,
      reason: "damaged",
      description: "Cagette écrasée pendant le transport.",
      requestedAmount: 1500,
    });
    await expect(
      scheduleReturnPickup(db, me(financeId, "admin"), ret.id, {
        driverId,
        scheduledFor: new Date().toISOString(),
        address: "",
      }),
    ).rejects.toThrow(/rôle/);
    await scheduleReturnPickup(db, me(adminId, "admin"), ret.id, {
      driverId,
      scheduledFor: new Date(Date.now() + 86_400_000).toISOString(),
      address: "",
    });
    await advanceReturnPickup(db, me(adminId, "admin"), ret.id, "picked_up");
    await advanceReturnPickup(db, me(adminId, "admin"), ret.id, "received", "Cagette écrasée");
    await inspectReturn(db, me(adminId, "admin"), ret.id, {
      conform: true,
      note: "Dommage constaté, imputable au transport.",
    });
    const driverBefore = await balance(driverId);
    await resolveReturn(db, me(adminId, "admin"), ret.id, {
      type: "refund",
      bornBy: "driver",
      amount: 1500,
      note: "Cagette écrasée pendant la livraison.",
    });
    expect(await balance(driverId)).toBe(driverBefore - 1500);
    // La décision peut être revue tant que le remboursement n'est pas payé.
    await resolveReturn(db, me(adminId, "admin"), ret.id, {
      type: "goodwill",
      bornBy: "driver",
      amount: 1000,
      note: "Geste commercial finalement.",
    });
    expect(await balance(driverId)).toBe(driverBefore);
    await closeReturn(db, me(adminId, "admin"), ret.id);
    const view = (await readReturns(db, me(adminId, "admin"))).find((r) => r.id === ret.id)!;
    expect(view.pickup).toMatchObject({ status: "received", receivedCondition: "Cagette écrasée" });
    expect(view.inspection?.conform).toBe(true);
    expect(view.resolution).toMatchObject({ type: "goodwill", bornBy: "platform" });
    expect(view.closedAt).toBeTruthy();
    expect(view.history.map((h) => h.text).join(" | ")).toContain("Dossier clôturé");
  });

  it("retour refusé puis escalade en litige d'un autre retour", async () => {
    const { orderId } = await deliveredOrder(10);
    const ret = await createReturn(db, me(restaurantId, "restaurant"), {
      orderId,
      productId: tomatoId,
      qty: 1,
      reason: "late",
      description: "Livraison arrivée trop tard pour le service.",
      requestedAmount: 700,
    });
    await expect(
      farmerDecideReturn(db, me(farmerId, "farmer"), ret.id, { accept: false, note: "" }),
    ).rejects.toThrow(/motif/);
    await farmerDecideReturn(db, me(farmerId, "farmer"), ret.id, {
      accept: false,
      note: "Livré dans le créneau prévu.",
    });
    const { disputeId } = await escalateReturn(
      db,
      me(adminId, "admin"),
      ret.id,
      "Le restaurant conteste le refus.",
    );
    const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
    expect(d).toMatchObject({
      openedBy: restaurantId,
      againstUserId: farmerId,
      claimedAmount: 700,
      subcategory: "Retour litigieux",
    });
    await expect(
      escalateReturn(db, me(adminId, "admin"), ret.id, "Encore une fois"),
    ).rejects.toThrow(/déjà en litige/);
  });

  it("incident : le livreur signale, l'équipe verse l'indemnité sur son solde", async () => {
    const missionId = missionIds[0];
    await expect(
      createIncident(db, me(otherRestaurantId, "restaurant"), {
        missionId,
        type: "client_absent",
        description: "x",
        waitedMinutes: 0,
        compensationRequested: 0,
      }),
    ).rejects.toThrow(/livreur/);
    const inc = await createIncident(db, me(driverId, "driver"), {
      missionId,
      type: "client_absent",
      description: "Restaurant fermé, 30 minutes d'attente.",
      waitedMinutes: 30,
      compensationRequested: 2000,
    });
    expect(inc.reference).toBe("INC-0001");
    await escalateIncident(db, me(driverId, "driver"), inc.id);
    await commentIncident(db, me(driverId, "driver"), inc.id, "J'ai appelé deux fois.");
    await expect(
      resolveIncident(db, me(financeId, "admin"), inc.id, { awarded: 1000 }),
    ).rejects.toThrow(/rôle/);
    await expect(
      resolveIncident(db, me(adminId, "admin"), inc.id, { awarded: 5000 }),
    ).rejects.toThrow(/demandée/);
    const before = await balance(driverId);
    const platformBefore = await balance(null);
    await resolveIncident(db, me(adminId, "admin"), inc.id, {
      awarded: 1500,
      note: "Attente avérée",
    });
    expect(await balance(driverId)).toBe(before + 1500);
    expect(await balance(null)).toBe(platformBefore - 1500);
    const [view] = await readIncidents(db, me(driverId, "driver"));
    expect(view).toMatchObject({
      status: "resolved",
      compensationAwarded: 1500,
      severity: "medium",
      driverId,
    });
    expect(view.history.map((h) => h.text)).toContain("J'ai appelé deux fois.");
    expect(await readIncidents(db, me(financeId, "admin"))).toHaveLength(0);
    await expect(resolveIncident(db, me(adminId, "admin"), inc.id, { awarded: 0 })).rejects.toThrow(
      /déjà/,
    );
  });

  it("incident ouvert par l'équipe depuis une livraison : rattaché au livreur", async () => {
    await expect(
      createIncident(db, me(financeId, "admin"), {
        missionId: missionIds[1],
        type: "address",
        description: "Adresse introuvable signalée par téléphone.",
        waitedMinutes: 0,
        compensationRequested: 0,
      }),
    ).rejects.toThrow(/rôle/);
    const inc = await createIncident(db, me(adminId, "admin"), {
      missionId: missionIds[1],
      type: "address",
      description: "Adresse introuvable signalée par téléphone.",
      waitedMinutes: 0,
      compensationRequested: 0,
    });
    const [view] = (await readIncidents(db, me(driverId, "driver"))).filter((i) => i.id === inc.id);
    expect(view).toMatchObject({ driverId, severity: "low", status: "open" });
    expect(view.history[0].text).toBe("Incident ouvert par l'équipe");

    // Remboursement du restaurant livré pendant cette course, à la charge de
    // la plateforme : rejoint les remboursements à verser.
    await expect(
      refundRestaurantForIncident(db, me(financeId, "admin"), inc.id, { amount: 1000 }),
    ).rejects.toThrow(/rôle/);
    await expect(
      refundRestaurantForIncident(db, me(adminId, "admin"), inc.id, { amount: 100_000_000 }),
    ).rejects.toThrow(/remboursable/);
    const platformBefore = await balance(null);
    const refund = await refundRestaurantForIncident(db, me(adminId, "admin"), inc.id, {
      amount: 1200,
      reason: "Livraison en retard",
    });
    const [row] = await db.select().from(refunds).where(eq(refunds.id, refund.id));
    expect(row).toMatchObject({
      source: "incident",
      amount: 1200,
      bornBy: "platform",
      status: "pending",
    });
    expect(await balance(null)).toBe(platformBefore - 1200);
    const [after] = (await readIncidents(db, me(adminId, "admin"))).filter((i) => i.id === inc.id);
    expect(after.history.at(-1)?.text).toMatch(/Remboursement REM-\d+ .* créé pour le restaurant/);
  });

  it("modération : signalement, retrait du catalogue, historique", async () => {
    await reportProduct(db, restaurantId, tomatoId, "Photo qui ne correspond pas au produit.");
    await expect(
      reportProduct(db, restaurantId, tomatoId, "Encore la même chose."),
    ).rejects.toThrow(/déjà signalé/);
    await reportProduct(db, otherRestaurantId, tomatoId, "Prix incohérent avec la qualité.");
    let queue = await readModeration(db);
    expect(queue[0]).toMatchObject({ productId: tomatoId, status: "pending" });
    expect(queue[0].reports).toHaveLength(2);
    await moderateProduct(db, adminId, tomatoId, "request_change", "Changez la photo principale.");
    await moderateProduct(db, adminId, tomatoId, "unpublish", "Photo trompeuse.");
    const [p] = await db.select().from(products).where(eq(products.id, tomatoId));
    expect(p.status).toBe("draft");
    queue = await readModeration(db);
    expect(queue[0].status).toBe("removed");
    expect(queue[0].events.map((e) => e.label)).toEqual([
      "Modification demandée — Changez la photo principale.",
      "Produit retiré du catalogue — Photo trompeuse.",
    ]);
    await db.update(products).set({ status: "active" }).where(eq(products.id, tomatoId));
  });

  it("statut des comptes : suspension, réactivation, garde-fous", async () => {
    const store = new DbAccountStore(db);
    const actor = (await store.findByEmail("admin@diambar.sn"))!;
    await expect(setAccountStatus(db, actor, actor.id, "suspended")).rejects.toThrow(/propre/);
    await setAccountStatus(db, actor, farmerId, "suspended", "Contrôle qualité");
    expect((await store.findByEmail("agriculteur@diambar.sn"))?.status).toBe("suspended");
    await setAccountStatus(db, actor, farmerId, "active");
    expect((await store.findByEmail("agriculteur@diambar.sn"))?.status).toBe("active");
    const finance = (await store.findByEmail("finance.apres@exemple.sn"))!;
    await expect(setAccountStatus(db, finance, farmerId, "suspended")).rejects.toThrow(
      /ne permet pas/,
    );
    const pending = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.status, "pending")));
    if (pending[0]) {
      await expect(setAccountStatus(db, actor, pending[0].id, "active")).rejects.toThrow(
        /Validations/,
      );
    }
  });
});
