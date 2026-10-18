// Profils et réglages personnels en base (tests sur une vraie base PostgreSQL,
// fichier « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { farmers, ledgerEntries, notifications, payouts, restaurants, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { RECEPTION_DAYS } from "@/data/mocks";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import { notifyUser } from "./market-common.server";
import { requestPayout } from "./payouts-db.server";
import {
  readPreferences,
  requestAccountDeletion,
  updateAccount,
  updateFarm,
  updatePreferences,
  updateRestaurant,
} from "./profile-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_profile_test";

describe.skipIf(!adminUrl)("profils et réglages (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let farmerId: string;
  let restaurantId: string;
  let otherRestaurantId: string;
  let adminId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const notified = async (userId: string, title: string) =>
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.title, title)));
  const hours = (from = "07:00", to = "11:00") =>
    Object.fromEntries(RECEPTION_DAYS.map((d) => [d, { open: d !== "Dimanche", from, to }]));

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
  });

  afterAll(async () => {
    await close?.();
  });

  it("compte : nom, téléphone unique, ville desservie", async () => {
    await updateAccount(
      db,
      { id: restaurantId, role: "restaurant" },
      {
        firstName: "Awa",
        lastName: "Ndiaye",
        phone: "+221 77 555 44 33",
        city: "Dakar",
      },
    );
    const [u] = await db.select().from(users).where(eq(users.id, restaurantId));
    expect(u).toMatchObject({ firstName: "Awa", lastName: "Ndiaye", phone: "775554433" });
    expect(u.cityId).toBeTruthy();
    const [other] = await db.select().from(users).where(eq(users.id, otherRestaurantId));
    await expect(
      updateAccount(db, { id: restaurantId, role: "restaurant" }, { phone: other.phone! }),
    ).rejects.toThrow(/déjà utilisé/);
    await expect(
      updateAccount(db, { id: restaurantId, role: "restaurant" }, { city: "Paris" }),
    ).rejects.toThrow(/non desservie/);
    await expect(
      updateAccount(db, { id: restaurantId, role: "restaurant" }, { phone: "12" }),
    ).rejects.toThrow(/9 chiffres/);
  });

  it("restaurant : fiche et créneaux de réception vérifiés", async () => {
    await updateRestaurant(
      db,
      { id: restaurantId, role: "restaurant" },
      {
        name: "Le Baobab Plateau",
        cuisine: "Sénégalaise",
        description: "Cuisine du marché.",
        contactName: "Awa Ndiaye",
        capacity: 60,
        address: "12 rue Carnot, Dakar Plateau",
        ninea: "00512345 2A2",
        billingEmail: "Compta@Baobab.sn",
        receptionHours: hours(),
      },
    );
    const [r] = await db.select().from(restaurants).where(eq(restaurants.userId, restaurantId));
    expect(r).toMatchObject({
      name: "Le Baobab Plateau",
      capacity: 60,
      contactName: "Awa Ndiaye",
      billingEmail: "compta@baobab.sn",
    });
    expect((r.receptionHours as Record<string, { open: boolean }>).Dimanche.open).toBe(false);
    await expect(
      updateRestaurant(
        db,
        { id: restaurantId, role: "restaurant" },
        {
          receptionHours: hours("11:00", "07:00"),
        },
      ),
    ).rejects.toThrow(/fin doit suivre/);
    await expect(
      updateRestaurant(db, { id: restaurantId, role: "restaurant" }, { address: "court" }),
    ).rejects.toThrow(/10 caractères/);
    await expect(
      updateRestaurant(db, { id: farmerId, role: "farmer" }, { name: "Pas un resto" }),
    ).rejects.toThrow(/restaurants/);
  });

  it("préférences : notifications coupées selon le rôle, et respectées", async () => {
    await updatePreferences(
      db,
      { id: restaurantId, role: "restaurant" },
      {
        mutedNotifications: ["order", "stock", "payment"],
        newsletter: true,
      },
    );
    const [u] = await db.select().from(users).where(eq(users.id, restaurantId));
    // Seul « order » se coupe pour un restaurant ; les paiements arrivent toujours.
    expect(readPreferences(u.preferences)).toMatchObject({
      mutedNotifications: ["order"],
      newsletter: true,
    });
    await notifyUser(db, restaurantId, { type: "order", title: "Test coupé", body: "x" });
    await notifyUser(db, restaurantId, { type: "payment", title: "Test paiement", body: "x" });
    expect(await notified(restaurantId, "Test coupé")).toHaveLength(0);
    expect(await notified(restaurantId, "Test paiement")).toHaveLength(1);
  });

  it("numéros de retrait : vérifiés, et utilisés par défaut pour un retrait", async () => {
    await expect(
      updatePreferences(
        db,
        { id: farmerId, role: "farmer" },
        {
          payout: { wave: "12 34", primary: "wave" },
        },
      ),
    ).rejects.toThrow(/Numéro invalide/);
    await expect(
      updatePreferences(
        db,
        { id: farmerId, role: "farmer" },
        {
          payout: { orangeMoney: "", primary: "orange_money" },
        },
      ),
    ).rejects.toThrow(/moyen de retrait préféré/);
    await updatePreferences(
      db,
      { id: farmerId, role: "farmer" },
      {
        payout: { wave: "76 111 22 33", orangeMoney: "78 444 55 66", primary: "wave" },
      },
    );
    await expect(
      updatePreferences(
        db,
        { id: restaurantId, role: "restaurant" },
        {
          payout: { wave: "761112233" },
        },
      ),
    ).rejects.toThrow(/Pas de retrait/);
    await db.insert(ledgerEntries).values({
      account: "farmer",
      userId: farmerId,
      kind: "adjustment",
      amount: 20_000,
      note: "Solde de test",
    });
    await requestPayout(db, farmerId, { amount: 5000, method: "orange_money" });
    const [p] = await db.select().from(payouts).where(eq(payouts.userId, farmerId));
    expect(p.accountNumber).toBe("784445566");
  });

  it("exploitation : nouvelle adresse de collecte → position effacée, équipe prévenue", async () => {
    await db.update(farmers).set({ lat: 14.7, lng: -17.1 }).where(eq(farmers.userId, farmerId));
    await updateFarm(
      db,
      { id: farmerId, role: "farmer" },
      {
        name: "Ferme des Niayes",
        address: "Route de Sangalkam, km 4",
        areaHa: 3.25,
        certification: "bio",
        productionTypes: ["Légumes", "Légumes", " Fruits "],
        description: "Maraîchage.",
        lang: "wo",
      },
    );
    const [f] = await db.select().from(farmers).where(eq(farmers.userId, farmerId));
    expect(f).toMatchObject({
      farmName: "Ferme des Niayes",
      lat: null,
      lng: null,
      certification: "bio",
      lang: "wo",
      areaHa: 3.25,
    });
    expect(f.productionTypes).toEqual(["Légumes", "Fruits"]);
    expect(await notified(adminId, "Adresse de collecte modifiée")).toHaveLength(1);
  });

  it("demande de suppression : l'équipe est prévenue", async () => {
    await requestAccountDeletion(db, { id: farmerId, role: "farmer" }, "J'arrête l'activité");
    expect(await notified(adminId, "Demande de suppression de compte")).toHaveLength(1);
  });

  it("sécurité : date du mot de passe et journal du compte", async () => {
    const store = new DbAccountStore(db);
    await store.setPasswordHash(
      farmerId,
      "$2a$04$abcdefghijklmnopqrstuuJ8m1vZQhC7l5r1H8u6R5lV3x3pF3uK",
    );
    const account = await store.findById(farmerId);
    expect(account?.passwordChangedAt).toBeInstanceOf(Date);
    await store.audit({
      actorId: farmerId,
      module: "security",
      action: "Mot de passe modifié",
      targetType: "user",
      targetId: farmerId,
    });
    const events = await store.securityEvents(farmerId, 5);
    expect(events[0]).toMatchObject({ action: "Mot de passe modifié", status: "success" });
  });
});
