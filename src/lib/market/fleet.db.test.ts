// Flotte des livreurs en base (tests sur une vraie base PostgreSQL, fichier
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import {
  adminProfiles,
  documents,
  drivers,
  missions,
  products,
  settings,
  users,
  vehicles,
} from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import {
  decideDocRenewal,
  decideVehicleChange,
  logMaintenance,
  readDriverFleet,
  readFleetQueue,
  reportVehicleIssue,
  requestVehicleChange,
  resolveVehicleIssue,
  setDriverOnline,
  submitDocRenewal,
  updateVehicle,
  updateWorkSettings,
} from "./fleet-db.server";
import { acceptMission, confirmOrder, placeOrder } from "./market-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_fleet_test";
const photo = (name: string) => ({
  storageKey: `non-conserve/${name}.png`,
  mime: "image/png",
  size: 1000,
  name,
});
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!adminUrl)("flotte des livreurs (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let driverId: string;
  let adminId: string;
  let financeId: string;
  let farmerId: string;
  let restaurantId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const me = (id: string, role: "restaurant" | "farmer" | "driver" | "admin") => ({ id, role });

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
    driverId = await idOf("livreur@diambar.sn");
    adminId = await idOf("admin@diambar.sn");
    farmerId = await idOf("agriculteur@diambar.sn");
    restaurantId = await idOf("restaurant@diambar.sn");
    const [f] = await db
      .insert(users)
      .values({
        role: "admin",
        email: "finance.flotte@exemple.sn",
        phone: "760000032",
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
    await db
      .update(vehicles)
      .set({ capacityKg: 900, insuranceExpiresAt: inDays(200), inspectionExpiresAt: inDays(200) })
      .where(eq(vehicles.driverId, driverId));
  });

  afterAll(async () => {
    await close?.();
  });

  it("fiche du véhicule : kilométrage qui ne recule pas, entretien programmé puis fait", async () => {
    await updateVehicle(db, me(driverId, "driver"), {
      brand: "Honda",
      model: "CG 125",
      year: 2021,
      color: "Rouge",
      mileageKm: 12000,
      nextMaintenanceAt: inDays(10),
    });
    await expect(updateVehicle(db, me(driverId, "driver"), { mileageKm: 11000 })).rejects.toThrow(
      /supérieur/,
    );
    let fleet = await readDriverFleet(db, driverId);
    expect(fleet.vehicle).toMatchObject({
      brand: "Honda",
      model: "CG 125",
      mileageKm: 12000,
      nextMaintenanceAt: inDays(10),
    });
    await logMaintenance(db, me(driverId, "driver"), "Vidange");
    fleet = await readDriverFleet(db, driverId);
    expect(fleet.maintenance[0]).toMatchObject({ label: "Vidange", mileageKm: 12000 });
    expect(fleet.vehicle?.nextMaintenanceAt).toBeUndefined();
  });

  it("problème mécanique : point « à vérifier » jusqu'à résolution", async () => {
    const issue = await reportVehicleIssue(
      db,
      me(driverId, "driver"),
      { type: "brakes", severity: "high", description: "Freins qui grincent fort." },
      [photo("frein")],
    );
    expect(issue.reference).toBe("VH-0001");
    let fleet = await readDriverFleet(db, driverId);
    expect(fleet.vehicle?.condition.brakes).toBe("check");
    expect(fleet.issues[0]).toMatchObject({ status: "reported", severity: "high" });
    expect(fleet.issues[0].photos).toHaveLength(1);
    await resolveVehicleIssue(db, me(driverId, "driver"), issue.id);
    fleet = await readDriverFleet(db, driverId);
    expect(fleet.vehicle?.condition.brakes).toBe("good");
  });

  it("document renouvelé : compte seulement après validation de l'équipe", async () => {
    await expect(
      submitDocRenewal(db, me(driverId, "driver"), { doc: "insurance", newExpiry: inDays(-1) }, [
        photo("a"),
      ]),
    ).rejects.toThrow(/futur/);
    const r = await submitDocRenewal(
      db,
      me(driverId, "driver"),
      { doc: "insurance", newExpiry: inDays(365) },
      [photo("assurance")],
    );
    expect((await readDriverFleet(db, driverId)).vehicle?.insuranceExpiry).toBe(inDays(200));
    const queue = await readFleetQueue(db, adminId);
    expect(queue.renewals[0]).toMatchObject({ id: r.id, status: "pending" });
    expect(queue.renewals[0].photos).toHaveLength(1);
    expect((await readFleetQueue(db, financeId)).renewals).toHaveLength(0);
    await expect(
      decideDocRenewal(db, me(financeId, "admin"), r.id, { approve: true }),
    ).rejects.toThrow(/rôle/);
    await decideDocRenewal(db, me(adminId, "admin"), r.id, { approve: true });
    expect((await readDriverFleet(db, driverId)).vehicle?.insuranceExpiry).toBe(inDays(365));
    const docs = await db.select().from(documents).where(eq(documents.userId, driverId));
    expect(docs.some((d) => d.kind === "assurance" && d.status === "ok")).toBe(true);
    const r2 = await submitDocRenewal(
      db,
      me(driverId, "driver"),
      { doc: "inspection", newExpiry: inDays(300) },
      [photo("ct")],
    );
    await expect(
      decideDocRenewal(db, me(adminId, "admin"), r2.id, { approve: false, note: "" }),
    ).rejects.toThrow(/motif/);
    await decideDocRenewal(db, me(adminId, "admin"), r2.id, {
      approve: false,
      note: "Photo illisible",
    });
    const fleet = await readDriverFleet(db, driverId);
    expect(fleet.renewals.find((x) => x.id === r2.id)).toMatchObject({
      status: "rejected",
      note: "Photo illisible",
    });
    expect(fleet.vehicle?.inspectionExpiry).toBe(inDays(200));
  });

  it("en ligne, documents expirés : l'acceptation de course est bloquée", async () => {
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
    await confirmOrder(db, farmerId, placed.orders[0].id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, placed.orders[0].id));
    await setDriverOnline(db, me(driverId, "driver"), false);
    await expect(acceptMission(db, driverId, m.id)).rejects.toThrow(/en ligne/);
    await setDriverOnline(db, me(driverId, "driver"), true);
    await db
      .update(vehicles)
      .set({ inspectionExpiresAt: inDays(-2) })
      .where(eq(vehicles.driverId, driverId));
    await expect(acceptMission(db, driverId, m.id)).rejects.toThrow(/expiré/);
    await db
      .update(vehicles)
      .set({ inspectionExpiresAt: inDays(200) })
      .where(eq(vehicles.driverId, driverId));
    await acceptMission(db, driverId, m.id);
    expect((await readDriverFleet(db, driverId)).online).toBe(true);
  });

  it("changement de véhicule : une demande à la fois, validée par l'équipe", async () => {
    const newVehicle = {
      type: "Camionnette" as const,
      brand: "Renault",
      model: "Kangoo",
      year: 2019,
      plate: "dk-5678-cd",
      capacityKg: 700,
      mileageKm: 80000,
    };
    await expect(
      requestVehicleChange(db, me(driverId, "driver"), { reason: "new_vehicle", newVehicle }),
    ).rejects.toThrow(/carte grise/);
    const req = await requestVehicleChange(
      db,
      me(driverId, "driver"),
      { reason: "new_vehicle", newVehicle },
      [photo("carte-grise")],
    );
    expect(req.reference).toBe("VCR-0001");
    await expect(
      requestVehicleChange(db, me(driverId, "driver"), { reason: "other", newVehicle }, [
        photo("x"),
      ]),
    ).rejects.toThrow(/déjà en cours/);
    await decideVehicleChange(db, me(adminId, "admin"), req.id, { approve: true });
    const fleet = await readDriverFleet(db, driverId);
    expect(fleet.vehicle).toMatchObject({
      type: "Camionnette",
      plate: "DK-5678-CD",
      capacityKg: 700,
      brand: "Renault",
      insuranceExpiry: "",
    });
    const all = await db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
    expect(all.filter((v) => v.status === "active")).toHaveLength(1);
    expect(fleet.changeRequests[0].status).toBe("approved");
  });

  it("préférences de travail, horaires et partage de position", async () => {
    await updateWorkSettings(db, me(driverId, "driver"), {
      workPrefs: {
        radius: 30,
        autoAccept: true,
        criteria: {
          minPayout: 2500,
          maxWeightKg: 500,
          acceptedUrgencies: ["standard", "express"],
          acceptedCities: ["Dakar"],
        },
      },
      locationSharing: false,
    });
    const hours = {
      mon: { enabled: true, start: "07:00", end: "15:00" },
      tue: { enabled: true, start: "07:00", end: "15:00" },
      wed: { enabled: true, start: "07:00", end: "15:00" },
      thu: { enabled: true, start: "07:00", end: "15:00" },
      fri: { enabled: true, start: "07:00", end: "15:00" },
      sat: { enabled: false, start: "08:00", end: "12:00" },
      sun: { enabled: false, start: "08:00", end: "12:00" },
    };
    await updateWorkSettings(db, me(driverId, "driver"), { workingHours: hours });
    await expect(
      updateWorkSettings(db, me(driverId, "driver"), {
        workingHours: { ...hours, mon: { enabled: true, start: "18:00", end: "08:00" } },
      }),
    ).rejects.toThrow(/fin/);
    const fleet = await readDriverFleet(db, driverId);
    expect(fleet.workPrefs).toMatchObject({ radius: 30, autoAccept: true });
    expect(fleet.workPrefs?.criteria.acceptedUrgencies).toEqual(["standard", "express"]);
    expect(fleet.workingHours?.mon.start).toBe("07:00");
    expect(fleet.locationSharing).toBe(false);
    const [d] = await db.select().from(drivers).where(eq(drivers.userId, driverId));
    expect(d.locationSharing).toBe(false);
  });
});
