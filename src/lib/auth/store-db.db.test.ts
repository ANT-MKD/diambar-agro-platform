// Annuaire des comptes sur une vraie base PostgreSQL (même principe que
// src/db/schema.db.test.ts) : ne tourne que si TEST_DATABASE_URL est défini.
import { compareSync, hashSync } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { driverZones, farmers, settings, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { DbAccountStore } from "./store-db.server";
import type { NewApplicant } from "./store.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_accounts_test";

describe.skipIf(!adminUrl)("annuaire des comptes (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let store: DbAccountStore;
  let adminId: string;

  const applicant = (over: Partial<NewApplicant> = {}): NewApplicant => ({
    role: "farmer",
    email: "moussa@exemple.sn",
    phone: "701234567",
    passwordHash: hashSync("Diambar2026!", 4),
    firstName: "Moussa",
    lastName: "Sarr",
    city: "Dakar",
    details: { farmName: "Ferme Sarr", location: "Sangalkam", areaHectares: "3,5" },
    acceptedTermsAt: new Date(),
    ...over,
  });

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
    store = new DbAccountStore(db);
    adminId = (await store.findByEmail("admin@diambar.sn"))!.id;
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  it("lit un compte avec son rôle d'équipe", async () => {
    const admin = await store.findByEmail("admin@diambar.sn");
    expect(admin?.role).toBe("admin");
    expect(admin?.staffRole).toBe("super_admin");
    expect(compareSync("demo1234", admin!.passwordHash)).toBe(true);
    expect((await store.findByEmail("agriculteur@diambar.sn"))?.staffRole).toBeNull();
    expect(await store.findByEmail("personne@exemple.sn")).toBeNull();
  });

  it("crée un producteur en attente, avec son profil et son dossier", async () => {
    const res = await store.createApplicant(applicant());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.account.status).toBe("pending");
    const [farm] = await db.select().from(farmers).where(eq(farmers.userId, res.account.id));
    expect(farm.farmName).toBe("Ferme Sarr");
    expect(farm.areaHa).toBe(3.5);
    const app = await store.getApplication(res.applicationId);
    expect(app?.status).toBe("pending");
    expect(app?.submitted.details.farmName).toBe("Ferme Sarr");
    expect(app?.submitted.city).toBe("Dakar");
  });

  it("refuse un email ou un téléphone déjà pris", async () => {
    expect(await store.createApplicant(applicant({ phone: "709999999" }))).toEqual({
      ok: false,
      reason: "email_taken",
    });
    expect(
      await store.createApplicant(applicant({ email: "autre@exemple.sn", phone: "701234567" })),
    ).toEqual({ ok: false, reason: "phone_taken" });
    expect(await store.emailTaken("moussa@exemple.sn")).toBe(true);
    expect(await store.phoneTaken("701234567")).toBe(true);
  });

  it("rattache un livreur aux zones connues seulement", async () => {
    const res = await store.createApplicant(
      applicant({
        role: "driver",
        email: "ibrahima@exemple.sn",
        phone: "781112233",
        details: { vehicleType: "Moto", licenseNumber: "SN-1", zones: ["Plateau", "Inconnue"] },
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const zones = await db
      .select()
      .from(driverZones)
      .where(eq(driverZones.driverId, res.account.id));
    expect(zones.length).toBe(1);
    const app = await store.latestApplicationFor(res.account.id);
    expect(app?.submitted.details.zones).toEqual(["Plateau", "Inconnue"]);
  });

  it("décide un dossier une seule fois et met le compte à jour", async () => {
    const account = (await store.findByEmail("moussa@exemple.sn"))!;
    const app = (await store.latestApplicationFor(account.id))!;

    const correction = await store.decideApplication({
      id: app.id,
      decision: "needs_correction",
      note: "Précisez la parcelle",
      actorId: adminId,
    });
    expect(correction.ok && correction.application.status).toBe("needs_correction");
    expect((await store.findById(account.id))?.status).toBe("pending");

    const approved = await store.decideApplication({
      id: app.id,
      decision: "approve",
      actorId: adminId,
    });
    expect(approved.ok).toBe(true);
    if (approved.ok) expect(approved.application.decidedBy).toBeTruthy();
    expect((await store.findById(account.id))?.status).toBe("active");

    expect(
      await store.decideApplication({
        id: app.id,
        decision: "reject",
        note: "trop tard",
        actorId: adminId,
      }),
    ).toEqual({ ok: false, reason: "already_decided" });
    expect(await store.getApplication("pas-un-uuid")).toBeNull();
  });

  it("enregistre la connexion, le nouveau mot de passe et le journal", async () => {
    const account = (await store.findByEmail("moussa@exemple.sn"))!;
    await store.recordLogin(account.id);
    await store.setPasswordHash(account.id, hashSync("Nouveau2026!", 4));
    const after = (await store.findById(account.id))!;
    expect(after.lastLoginAt).not.toBeNull();
    expect(compareSync("Nouveau2026!", after.passwordHash)).toBe(true);
    const [row] = await db.execute<{ n: string }>(
      sql`select count(*) as n from audit_logs where target_id = ${account.id}`,
    );
    // inscription + 2 décisions
    expect(Number(row.n)).toBeGreaterThanOrEqual(3);
  });

  it("lit l'ouverture des inscriptions et les villes proposées", async () => {
    expect(await store.registrationsOpen()).toBe(true); // données de démo
    await db.update(settings).set({ value: false }).where(eq(settings.key, "registrations_open"));
    expect(await store.registrationsOpen()).toBe(false);
    const options = await store.registrationOptions();
    expect(options?.cities).toContain("Dakar");
    expect(options?.zones).toContain("Plateau");
  });

  it("ignore les comptes supprimés", async () => {
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.email, "ibrahima@exemple.sn"));
    expect(await store.findByEmail("ibrahima@exemple.sn")).toBeNull();
    // l'adresse reste réservée : pas de nouveau compte avec le même email
    expect(await store.emailTaken("ibrahima@exemple.sn")).toBe(true);
  });

  it("enregistre les réglages, la zone pilote et le catalogue", async () => {
    await store.setSettings({ cutoff_hour: 17, company: { legalName: "Diambar" } }, adminId);
    expect(await store.getSettings(["cutoff_hour", "company", "absent"])).toEqual({
      cutoff_hour: 17,
      company: { legalName: "Diambar" },
    });

    await store.savePilotZone(
      { city: "Dakar", baseFee: 1500, perKmFee: 100, zones: ["Plateau", "Nouveau quartier"] },
      adminId,
    );
    const zone = await store.getPilotZone();
    expect(zone).toEqual({
      city: "Dakar",
      baseFee: 1500,
      perKmFee: 100,
      zones: ["Nouveau quartier", "Plateau"],
    });
    // pilote : les autres villes sont fermées
    expect((await store.registrationOptions())?.cities).toEqual(["Dakar"]);

    // « Légumes » porte des produits de démo : jamais supprimée
    const kept = await store.saveCategories(["Fruits", "Produits laitiers"], adminId);
    expect(kept).toContain("Légumes");
    const names = (await store.listCategories()).map((c) => c.name);
    expect(names.slice(0, 2)).toEqual(["Fruits", "Produits laitiers"]);
    expect(names).toContain("Légumes");
    expect(names).not.toContain("Épices");
  });

  it("n'installe qu'un seul premier super administrateur", async () => {
    expect(await store.superAdminExists()).toBe(true);
    const refused = await store.createFirstSuperAdmin({
      email: "intrus@exemple.sn",
      phone: "771010101",
      passwordHash: hashSync("x", 4),
      firstName: "In",
      lastName: "Trus",
    });
    expect(refused).toEqual({ ok: false, reason: "already_installed" });

    // Base vide : deux installations simultanées → une seule réussit.
    await db.execute(sql`update admin_profiles set admin_role = 'operations'`);
    expect(await store.superAdminExists()).toBe(false);
    const attempt = (n: number) =>
      store.createFirstSuperAdmin({
        email: `install${n}@exemple.sn`,
        phone: `77202020${n}`,
        passwordHash: hashSync("x", 4),
        firstName: "Super",
        lastName: `Admin${n}`,
      });
    const results = await Promise.all([attempt(1), attempt(2)]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => !r.ok && r.reason === "already_installed").length).toBe(1);
  });

  it("ajoute un membre de l'équipe invité et active la double authentification", async () => {
    const res = await store.createStaffMember({
      email: "finance2@exemple.sn",
      phone: "763030303",
      passwordHash: hashSync("x", 4),
      firstName: "Fatou",
      lastName: "Sow",
      staffRole: "finance",
    });
    expect(res.ok && res.account.staffRole).toBe("finance");
    expect(
      await store.createStaffMember({
        email: "finance2@exemple.sn",
        phone: "763030304",
        passwordHash: "x",
        firstName: "F",
        lastName: "S",
        staffRole: "finance",
      }),
    ).toEqual({ ok: false, reason: "email_taken" });
    expect((await store.listStaff()).some((m) => m.email === "finance2@exemple.sn")).toBe(true);
    if (res.ok) {
      await store.setTwoFa(res.account.id, true);
      expect((await store.findById(res.account.id))?.twoFaEnabled).toBe(true);
    }
  });
});
