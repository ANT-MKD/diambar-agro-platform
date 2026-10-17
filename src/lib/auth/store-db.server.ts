import { and, desc, eq, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  adminProfiles,
  auditLogs,
  categories,
  cities,
  driverZones,
  drivers,
  farmers,
  restaurants,
  settings,
  users,
  validations,
  zones,
} from "@/db/schema";
import type { PilotZone, StaffSummary } from "@/lib/platform/setup-model";
import type { RegisterDetails } from "./session.server";
import type {
  AccountRecord,
  AccountStore,
  CategoryRow,
  Application,
  ApplicationDecision,
  AuditEntry,
  CreateApplicantResult,
  CreateStaffResult,
  NewStaffMember,
  DecideResult,
  NewApplicant,
  RegistrationOptions,
} from "./store.server";

const accountColumns = {
  id: users.id,
  email: users.email,
  role: users.role,
  status: users.status,
  passwordHash: users.passwordHash,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  twoFaEnabled: users.twoFaEnabled,
  staffRole: adminProfiles.adminRole,
  lastLoginAt: users.lastLoginAt,
};

/** Violation d'unicité PostgreSQL (email ou téléphone déjà pris entre-temps). */
function uniqueViolation(err: unknown): string | null {
  const e = err as { code?: string; constraint_name?: string; cause?: unknown };
  if (e?.code === "23505") return e.constraint_name ?? "";
  if (e?.cause) return uniqueViolation(e.cause);
  return null;
}

function parseArea(value?: string): number | null {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : null;
}

type SubmittedJson = { city?: string | null; details?: RegisterDetails } | null;

export class DbAccountStore implements AccountStore {
  readonly kind = "database" as const;

  constructor(private readonly db: Db) {}

  private accounts() {
    return this.db
      .select(accountColumns)
      .from(users)
      .leftJoin(adminProfiles, eq(adminProfiles.userId, users.id));
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const [row] = await this.accounts()
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<AccountRecord | null> {
    const [row] = await this.accounts()
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async emailTaken(email: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return !!row;
  }

  async phoneTaken(phone: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    return !!row;
  }

  async createApplicant(input: NewApplicant): Promise<CreateApplicantResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [city] = await tx
          .select({ id: cities.id })
          .from(cities)
          .where(sql`lower(${cities.name}) = lower(${input.city})`)
          .limit(1);
        const [user] = await tx
          .insert(users)
          .values({
            role: input.role,
            email: input.email,
            phone: input.phone,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: "pending",
            // Email confirmé par le code reçu ; le téléphone sera vérifié par
            // l'équipe (appel), puis par SMS quand un fournisseur sera branché.
            emailVerifiedAt: new Date(),
            acceptedTermsAt: input.acceptedTermsAt,
            cityId: city?.id ?? null,
          })
          .returning({ id: users.id });

        const d = input.details;
        if (input.role === "farmer") {
          await tx.insert(farmers).values({
            userId: user.id,
            farmName: (d.farmName ?? "").trim(),
            pickupAddress: (d.location ?? "").trim(),
            areaHa: parseArea(d.areaHectares),
          });
        } else if (input.role === "restaurant") {
          await tx.insert(restaurants).values({
            userId: user.id,
            name: (d.restaurantName ?? "").trim(),
            address: (d.address ?? "").trim(),
            ninea: d.ninea?.trim() || null,
            billingEmail: input.email,
          });
        } else {
          await tx.insert(drivers).values({
            userId: user.id,
            licenseNumber: d.licenseNumber?.trim() || null,
          });
          // Zones choisies parmi celles de la base ; un nom inconnu reste
          // visible dans le dossier (submitted) sans être rattaché.
          if (d.zones?.length) {
            const known = await tx
              .select({ id: zones.id })
              .from(zones)
              .where(and(inArray(zones.name, d.zones), eq(zones.active, true)));
            if (known.length) {
              await tx
                .insert(driverZones)
                .values(known.map((z) => ({ driverId: user.id, zoneId: z.id })))
                .onConflictDoNothing();
            }
          }
        }

        const [application] = await tx
          .insert(validations)
          .values({ userId: user.id, submitted: { city: input.city, details: d } })
          .returning({ id: validations.id });

        await tx.insert(auditLogs).values({
          actorId: user.id,
          module: "auth",
          action: "Inscription (compte en attente de validation)",
          targetType: "user",
          targetId: user.id,
          after: { role: input.role, email: input.email },
        });

        const account = await new DbAccountStore(tx as unknown as Db).findById(user.id);
        return { ok: true as const, account: account!, applicationId: application.id };
      });
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint === null) throw err;
      return { ok: false, reason: constraint.includes("phone") ? "phone_taken" : "email_taken" };
    }
  }

  async setPasswordHash(userId: string, hash: string): Promise<void> {
    await this.db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async recordLogin(userId: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async audit(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLogs).values({
      actorId: entry.actorId ?? null,
      module: entry.module,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      status: entry.status ?? "success",
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  }

  async registrationsOpen(): Promise<boolean> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "registrations_open"))
      .limit(1);
    return row?.value === true;
  }

  async registrationOptions(): Promise<RegistrationOptions> {
    const cityRows = await this.db
      .select({ name: cities.name })
      .from(cities)
      .where(eq(cities.active, true))
      .orderBy(cities.name);
    const zoneRows = await this.db
      .select({ name: zones.name })
      .from(zones)
      .innerJoin(cities, eq(cities.id, zones.cityId))
      .where(and(eq(zones.active, true), eq(cities.active, true)))
      .orderBy(zones.name);
    return { cities: cityRows.map((c) => c.name), zones: zoneRows.map((z) => z.name) };
  }

  private applications() {
    const decider = sql<
      string | null
    >`(select u2.first_name || ' ' || u2.last_name from users u2 where u2.id = "validations"."decided_by")`;
    return this.db
      .select({
        id: validations.id,
        status: validations.status,
        submittedAt: validations.submittedAt,
        decidedAt: validations.decidedAt,
        decidedBy: decider,
        note: validations.note,
        submitted: validations.submitted,
        userId: users.id,
        email: users.email,
        phone: users.phone,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        accountStatus: users.status,
      })
      .from(validations)
      .innerJoin(users, eq(users.id, validations.userId));
  }

  private toApplication(
    row: Awaited<ReturnType<DbAccountStore["applications"]>>[number],
  ): Application {
    const submitted = (row.submitted ?? null) as SubmittedJson;
    return {
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decidedBy: row.decidedBy,
      note: row.note,
      account: {
        id: row.userId,
        email: row.email,
        phone: row.phone,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role as Application["account"]["role"],
        status: row.accountStatus,
      },
      submitted: { city: submitted?.city ?? null, details: submitted?.details ?? {} },
    };
  }

  async listApplications(): Promise<Application[]> {
    const rows = await this.applications()
      .where(isNull(users.deletedAt))
      .orderBy(desc(validations.submittedAt))
      .limit(500);
    return rows.map((r) => this.toApplication(r));
  }

  async getApplication(id: string): Promise<Application | null> {
    // Identifiant venu de l'URL : on évite l'erreur PostgreSQL sur un uuid mal formé.
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = await this.applications().where(eq(validations.id, id)).limit(1);
    return row ? this.toApplication(row) : null;
  }

  async latestApplicationFor(userId: string): Promise<Application | null> {
    const [row] = await this.applications()
      .where(eq(validations.userId, userId))
      .orderBy(desc(validations.submittedAt))
      .limit(1);
    return row ? this.toApplication(row) : null;
  }

  async superAdminExists(): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(adminProfiles)
      .innerJoin(users, eq(users.id, adminProfiles.userId))
      .where(and(eq(adminProfiles.adminRole, "super_admin"), isNull(users.deletedAt)))
      .limit(1);
    return !!row;
  }

  async createFirstSuperAdmin(
    input: Omit<NewStaffMember, "staffRole">,
  ): Promise<CreateStaffResult> {
    try {
      return await this.db.transaction(async (tx) => {
        // Verrou le temps de la transaction : deux installations lancées en
        // même temps passent l'une après l'autre, la seconde est refusée.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('diambar_installation'))`);
        if (await new DbAccountStore(tx as unknown as Db).superAdminExists()) {
          return { ok: false as const, reason: "already_installed" as const };
        }
        const [user] = await tx
          .insert(users)
          .values({
            role: "admin",
            email: input.email,
            phone: input.phone,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: "active",
            emailVerifiedAt: input.emailVerified ? new Date() : null,
            twoFaEnabled: !!input.twoFaEnabled,
          })
          .returning({ id: users.id });
        await tx.insert(adminProfiles).values({ userId: user.id, adminRole: "super_admin" });
        await tx
          .insert(settings)
          .values({
            key: "platform_setup",
            value: { startedAt: new Date().toISOString(), steps: {} },
            updatedBy: user.id,
          })
          .onConflictDoNothing();
        await tx.insert(auditLogs).values({
          actorId: user.id,
          module: "installation",
          action: "Installation : premier super administrateur créé",
          targetType: "user",
          targetId: user.id,
          after: { email: input.email },
        });
        const account = await new DbAccountStore(tx as unknown as Db).findById(user.id);
        return { ok: true as const, account: account! };
      });
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint === null) throw err;
      return { ok: false, reason: constraint.includes("phone") ? "phone_taken" : "email_taken" };
    }
  }

  async getSettings(keys: string[]): Promise<Record<string, unknown>> {
    if (!keys.length) return {};
    const rows = await this.db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, keys));
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async setSettings(values: Record<string, unknown>, actorId: string): Promise<void> {
    const entries = Object.entries(values);
    if (!entries.length) return;
    await this.db.transaction(async (tx) => {
      const before = await new DbAccountStore(tx as unknown as Db).getSettings(
        entries.map(([k]) => k),
      );
      for (const [key, value] of entries) {
        await tx
          .insert(settings)
          .values({ key, value, updatedBy: actorId })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedBy: actorId, updatedAt: new Date() },
          });
      }
      await tx.insert(auditLogs).values({
        actorId,
        module: "settings",
        action: "Réglages modifiés",
        targetType: "settings",
        targetId: entries.map(([k]) => k).join(","),
        before,
        after: values,
      });
    });
  }

  async getPilotZone(): Promise<PilotZone | null> {
    const { pilot_city: name } = await this.getSettings(["pilot_city"]);
    if (typeof name !== "string") return null;
    const [city] = await this.db.select().from(cities).where(eq(cities.name, name)).limit(1);
    if (!city) return null;
    const zoneRows = await this.db
      .select({ name: zones.name })
      .from(zones)
      .where(and(eq(zones.cityId, city.id), eq(zones.active, true)))
      .orderBy(zones.name);
    return {
      city: city.name,
      baseFee: city.baseFee ?? 0,
      perKmFee: city.perKmFee ?? 0,
      zones: zoneRows.map((z) => z.name),
    };
  }

  async savePilotZone(zone: PilotZone, actorId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [city] = await tx
        .insert(cities)
        .values({ name: zone.city, active: true, baseFee: zone.baseFee, perKmFee: zone.perKmFee })
        .onConflictDoUpdate({
          target: cities.name,
          set: { active: true, baseFee: zone.baseFee, perKmFee: zone.perKmFee },
        })
        .returning({ id: cities.id });
      // Pilote : une seule ville ouverte.
      await tx.update(cities).set({ active: false }).where(ne(cities.id, city.id));
      if (zone.zones.length) {
        await tx
          .insert(zones)
          .values(zone.zones.map((name) => ({ cityId: city.id, name })))
          .onConflictDoNothing();
        await tx
          .update(zones)
          .set({ active: true })
          .where(and(eq(zones.cityId, city.id), inArray(zones.name, zone.zones)));
      }
      // Un quartier retiré est désactivé, jamais supprimé (commandes passées).
      await tx
        .update(zones)
        .set({ active: false })
        .where(
          zone.zones.length
            ? and(eq(zones.cityId, city.id), notInArray(zones.name, zone.zones))
            : eq(zones.cityId, city.id),
        );
      await tx
        .insert(settings)
        .values({ key: "pilot_city", value: zone.city, updatedBy: actorId })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: zone.city, updatedBy: actorId, updatedAt: new Date() },
        });
      await tx.insert(auditLogs).values({
        actorId,
        module: "settings",
        action: "Zone pilote enregistrée",
        targetType: "city",
        targetId: city.id,
        after: zone,
      });
    });
  }

  async listCategories(): Promise<CategoryRow[]> {
    const rows = await this.db
      .select({
        name: categories.name,
        // Colonnes écrites en entier : dans une sous-requête, drizzle ne
        // préfixerait pas « id » par la table, qui désignerait alors products.id.
        used: sql<boolean>`exists (select 1 from "products" p where p."category_id" = "categories"."id")`,
      })
      .from(categories)
      .orderBy(categories.sortOrder, categories.name);
    return rows;
  }

  async saveCategories(names: string[], actorId: string): Promise<string[]> {
    return this.db.transaction(async (tx) => {
      const existing = await new DbAccountStore(tx as unknown as Db).listCategories();
      const kept = existing.filter((c) => !names.includes(c.name) && c.used).map((c) => c.name);
      const removable = existing.filter((c) => !names.includes(c.name) && !c.used);
      if (removable.length) {
        await tx.delete(categories).where(
          inArray(
            categories.name,
            removable.map((c) => c.name),
          ),
        );
      }
      for (const [i, name] of [...names, ...kept].entries()) {
        await tx
          .insert(categories)
          .values({ name, sortOrder: i + 1 })
          .onConflictDoUpdate({ target: categories.name, set: { sortOrder: i + 1 } });
      }
      await tx.insert(auditLogs).values({
        actorId,
        module: "settings",
        action: "Catégories du catalogue enregistrées",
        targetType: "categories",
        before: existing.map((c) => c.name),
        after: [...names, ...kept],
      });
      return kept;
    });
  }

  async setTwoFa(userId: string, enabled: boolean): Promise<void> {
    await this.db
      .update(users)
      .set({ twoFaEnabled: enabled, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await this.audit({
      actorId: userId,
      module: "security",
      action: enabled ? "Double authentification activée" : "Double authentification désactivée",
      targetType: "user",
      targetId: userId,
    });
  }

  async listStaff(): Promise<StaffSummary[]> {
    const rows = await this.accounts()
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)))
      .orderBy(users.createdAt);
    return rows.map((r) => ({
      email: r.email,
      name: `${r.firstName} ${r.lastName}`.trim(),
      staffRole: r.staffRole,
      status: r.status,
    }));
  }

  async createStaffMember(input: NewStaffMember): Promise<CreateStaffResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            role: "admin",
            email: input.email,
            phone: input.phone,
            passwordHash: input.passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: "active",
          })
          .returning({ id: users.id });
        await tx.insert(adminProfiles).values({ userId: user.id, adminRole: input.staffRole });
        await tx.insert(auditLogs).values({
          actorId: user.id,
          module: "security",
          action: "Invitation acceptée : membre de l'équipe ajouté",
          targetType: "user",
          targetId: user.id,
          after: { email: input.email, role: input.staffRole },
        });
        const account = await new DbAccountStore(tx as unknown as Db).findById(user.id);
        return { ok: true as const, account: account! };
      });
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint === null) throw err;
      return { ok: false, reason: constraint.includes("phone") ? "phone_taken" : "email_taken" };
    }
  }

  async decideApplication(input: {
    id: string;
    decision: ApplicationDecision;
    note?: string;
    actorId: string;
  }): Promise<DecideResult> {
    const current = await this.getApplication(input.id);
    if (!current) return { ok: false, reason: "not_found" };
    if (current.status === "approved" || current.status === "rejected") {
      return { ok: false, reason: "already_decided" };
    }
    const status =
      input.decision === "approve"
        ? "approved"
        : input.decision === "reject"
          ? "rejected"
          : "needs_correction";
    const accountStatus =
      input.decision === "approve"
        ? "active"
        : input.decision === "reject"
          ? "rejected"
          : "pending";
    const note = input.note?.trim() || null;
    const changed = await this.db.transaction(async (tx) => {
      // Condition sur le statut : deux admins qui décident en même temps ne
      // peuvent pas écraser la décision l'un de l'autre.
      const updated = await tx
        .update(validations)
        .set({ status, note, decidedBy: input.actorId, decidedAt: new Date() })
        .where(
          and(
            eq(validations.id, input.id),
            inArray(validations.status, ["pending", "needs_correction"]),
          ),
        )
        .returning({ id: validations.id });
      if (!updated.length) return false;
      await tx
        .update(users)
        .set({ status: accountStatus, updatedAt: new Date() })
        .where(eq(users.id, current.account.id));
      await tx.insert(auditLogs).values({
        actorId: input.actorId,
        module: "validations",
        action:
          input.decision === "approve"
            ? "Compte validé"
            : input.decision === "reject"
              ? "Compte refusé"
              : "Correction demandée",
        targetType: "user",
        targetId: current.account.id,
        before: { validation: current.status, account: current.account.status },
        after: { validation: status, account: accountStatus, note },
      });
      return true;
    });
    if (!changed) return { ok: false, reason: "already_decided" };
    const after = await this.getApplication(input.id);
    return after ? { ok: true, application: after } : { ok: false, reason: "not_found" };
  }
}
