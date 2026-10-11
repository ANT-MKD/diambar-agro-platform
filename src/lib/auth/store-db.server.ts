import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  adminProfiles,
  auditLogs,
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
import type { RegisterDetails } from "./session.server";
import type {
  AccountRecord,
  AccountStore,
  Application,
  ApplicationDecision,
  AuditEntry,
  CreateApplicantResult,
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
            phoneVerifiedAt: new Date(),
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
    >`(select u2.first_name || ' ' || u2.last_name from users u2 where u2.id = ${validations.decidedBy})`;
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
