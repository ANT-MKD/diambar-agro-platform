import { hashSync } from "bcryptjs";
import { demoAccounts } from "@/data/demo-accounts";
import { deliveryZones, platformUsers } from "@/data/admin-mocks";
import { CATEGORY_NAMES, DEFAULT_SETTINGS } from "@/db/seed";
import { DAKAR_ZONES, type PilotZone, type StaffSummary } from "@/lib/platform/setup-model";
import { normalizeEmail, normalizeSenegalPhone } from "./helpers";
import type {
  AccountRecord,
  AccountStatus,
  AccountStore,
  Application,
  AuditEntry,
  CategoryRow,
  CreateApplicantResult,
  CreateStaffResult,
  DecideResult,
  NewApplicant,
  NewStaffMember,
  RegistrationOptions,
  StaffRole,
} from "./store.server";

// Annuaire en mémoire, réservé au mode démo sans base de données : comptes de
// démonstration + inscriptions faites depuis le démarrage du serveur. Rien
// n'est partagé entre instances ni conservé au redémarrage.

const LABEL_TO_STAFF: Record<string, StaffRole> = {
  "Super Administrateur": "super_admin",
  Finance: "finance",
  Opérations: "operations",
  Support: "support",
};

type MemoryAccount = AccountRecord & { city: string | null };

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  return { firstName: firstName ?? name, lastName: rest.join(" ") };
}

class MemoryAccountStore implements AccountStore {
  readonly kind = "memory" as const;
  private readonly accounts: MemoryAccount[] = [];
  private readonly applications: Application[] = [];
  private seq = 0;
  // Plateforme de démonstration : déjà configurée, inscriptions ouvertes.
  private readonly settings = new Map<string, unknown>([
    ...Object.entries(DEFAULT_SETTINGS),
    ["registrations_open", true],
    ["platform_setup", { demo: true, completedAt: new Date().toISOString() }],
    ["pilot_city", "Dakar"],
  ]);
  private pilotZone: PilotZone = {
    city: "Dakar",
    baseFee: deliveryZones[0]?.baseFee ?? 1000,
    perKmFee: deliveryZones[0]?.perKm ?? 120,
    zones: [...DAKAR_ZONES],
  };
  private categories: string[] = [...CATEGORY_NAMES];

  constructor() {
    for (const demo of demoAccounts) {
      const record = platformUsers.find((u) => normalizeEmail(u.email) === demo.email);
      const status: AccountStatus = record?.status ?? "active";
      let hash: string | null = null;
      const account: MemoryAccount = {
        id: `demo:${demo.email}`,
        email: normalizeEmail(demo.email),
        role: demo.role,
        status,
        // Haché à la première lecture seulement (coût réduit : mots de passe
        // de démonstration publics), pour ne pas ralentir le démarrage.
        get passwordHash() {
          hash ??= hashSync(demo.password, 4);
          return hash;
        },
        set passwordHash(value: string) {
          hash = value;
        },
        ...splitName(demo.name),
        phone: record ? normalizeSenegalPhone(record.phone) : null,
        twoFaEnabled: !!demo.twoFaEnabled,
        staffRole: demo.role === "admin" ? (LABEL_TO_STAFF[demo.label ?? ""] ?? null) : null,
        lastLoginAt: null,
        city: record?.city ?? null,
      };
      this.accounts.push(account);
    }
  }

  private nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}_${Date.now().toString(36)}${this.seq}`;
  }

  async findByEmail(email: string) {
    return this.accounts.find((a) => a.email === normalizeEmail(email)) ?? null;
  }

  async findById(id: string) {
    return this.accounts.find((a) => a.id === id) ?? null;
  }

  async emailTaken(email: string) {
    const key = normalizeEmail(email);
    return (
      this.accounts.some((a) => a.email === key) ||
      platformUsers.some((u) => normalizeEmail(u.email) === key)
    );
  }

  async phoneTaken(phone: string) {
    const wanted = normalizeSenegalPhone(phone);
    if (!wanted) return false;
    return (
      this.accounts.some((a) => a.phone === wanted) ||
      platformUsers.some((u) => normalizeSenegalPhone(u.phone) === wanted)
    );
  }

  async createApplicant(input: NewApplicant): Promise<CreateApplicantResult> {
    if (await this.emailTaken(input.email)) return { ok: false, reason: "email_taken" };
    if (await this.phoneTaken(input.phone)) return { ok: false, reason: "phone_taken" };
    const account: MemoryAccount = {
      id: this.nextId("user"),
      email: normalizeEmail(input.email),
      role: input.role,
      status: "pending",
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      twoFaEnabled: false,
      staffRole: null,
      lastLoginAt: null,
      city: input.city,
    };
    this.accounts.push(account);
    const application: Application = {
      id: this.nextId("dossier"),
      status: "pending",
      submittedAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      note: null,
      account: this.publicAccount(account),
      submitted: { city: input.city, details: input.details },
    };
    this.applications.unshift(application);
    return { ok: true, account, applicationId: application.id };
  }

  private publicAccount(a: MemoryAccount): Application["account"] {
    return {
      id: a.id,
      email: a.email,
      phone: a.phone,
      firstName: a.firstName,
      lastName: a.lastName,
      role: a.role as Application["account"]["role"],
      status: a.status,
    };
  }

  async setPasswordHash(userId: string, hash: string) {
    const account = this.accounts.find((a) => a.id === userId);
    if (account) account.passwordHash = hash;
  }

  async recordLogin(userId: string) {
    const account = this.accounts.find((a) => a.id === userId);
    if (account) account.lastLoginAt = new Date();
  }

  async audit(_entry: AuditEntry) {
    // Mode démo sans base : le journal d'audit de l'interface fait foi.
  }

  async registrationsOpen() {
    return this.settings.get("registrations_open") === true;
  }

  async registrationOptions(): Promise<RegistrationOptions> {
    return null;
  }

  private withLiveAccount(app: Application): Application {
    const account = this.accounts.find((a) => a.id === app.account.id);
    return account ? { ...app, account: this.publicAccount(account) } : app;
  }

  async listApplications() {
    return this.applications.map((a) => this.withLiveAccount(a));
  }

  async getApplication(id: string) {
    const app = this.applications.find((a) => a.id === id);
    return app ? this.withLiveAccount(app) : null;
  }

  async latestApplicationFor(userId: string) {
    const app = this.applications.find((a) => a.account.id === userId);
    return app ? this.withLiveAccount(app) : null;
  }

  async superAdminExists() {
    return this.accounts.some((a) => a.staffRole === "super_admin" && a.status === "active");
  }

  async createFirstSuperAdmin(): Promise<CreateStaffResult> {
    // Mode démo : les comptes d'administration de démonstration existent déjà.
    return { ok: false, reason: "already_installed" };
  }

  async getSettings(keys: string[]) {
    return Object.fromEntries(
      keys.filter((k) => this.settings.has(k)).map((k) => [k, this.settings.get(k)]),
    );
  }

  async setSettings(values: Record<string, unknown>) {
    for (const [k, v] of Object.entries(values)) this.settings.set(k, v);
  }

  async getPilotZone() {
    return this.pilotZone;
  }

  async savePilotZone(zone: PilotZone) {
    this.pilotZone = zone;
    this.settings.set("pilot_city", zone.city);
  }

  async listCategories(): Promise<CategoryRow[]> {
    return this.categories.map((name) => ({ name, used: false }));
  }

  async saveCategories(names: string[]) {
    this.categories = [...names];
    return [];
  }

  async setTwoFa(userId: string, enabled: boolean) {
    const account = this.accounts.find((a) => a.id === userId);
    if (account) account.twoFaEnabled = enabled;
  }

  async listStaff(): Promise<StaffSummary[]> {
    return this.accounts
      .filter((a) => a.role === "admin")
      .map((a) => ({
        email: a.email,
        name: `${a.firstName} ${a.lastName}`.trim(),
        staffRole: a.staffRole,
        status: a.status,
      }));
  }

  async createStaffMember(input: NewStaffMember): Promise<CreateStaffResult> {
    if (await this.emailTaken(input.email)) return { ok: false, reason: "email_taken" };
    if (await this.phoneTaken(input.phone)) return { ok: false, reason: "phone_taken" };
    const account: MemoryAccount = {
      id: this.nextId("user"),
      email: normalizeEmail(input.email),
      role: "admin",
      status: "active",
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      twoFaEnabled: false,
      staffRole: input.staffRole,
      lastLoginAt: null,
      city: null,
    };
    this.accounts.push(account);
    return { ok: true, account };
  }

  async decideApplication(input: {
    id: string;
    decision: "approve" | "reject" | "needs_correction";
    note?: string;
    actorId: string;
  }): Promise<DecideResult> {
    const app = this.applications.find((a) => a.id === input.id);
    if (!app) return { ok: false, reason: "not_found" };
    if (app.status === "approved" || app.status === "rejected") {
      return { ok: false, reason: "already_decided" };
    }
    const actor = this.accounts.find((a) => a.id === input.actorId);
    app.status =
      input.decision === "approve"
        ? "approved"
        : input.decision === "reject"
          ? "rejected"
          : "needs_correction";
    app.note = input.note?.trim() || null;
    app.decidedAt = new Date().toISOString();
    app.decidedBy = actor ? `${actor.firstName} ${actor.lastName}`.trim() : null;
    const account = this.accounts.find((a) => a.id === app.account.id);
    if (account) {
      account.status =
        input.decision === "approve"
          ? "active"
          : input.decision === "reject"
            ? "rejected"
            : "pending";
    }
    return { ok: true, application: this.withLiveAccount(app) };
  }
}

export const memoryAccountStore = new MemoryAccountStore();
