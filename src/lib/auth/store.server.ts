import type { Role } from "@/data/mocks";
import type { AdminRoleName } from "@/data/admin-mocks";
import { createDb } from "@/db/client.server";
import { isDemoMode } from "./config.server";
import type { RegisterDetails } from "./session.server";
import { DbAccountStore } from "./store-db.server";
import { memoryAccountStore } from "./store-memory.server";

// --- Annuaire des comptes ------------------------------------------------------
// Deux sources possibles, derrière la même interface :
// - la base PostgreSQL (Supabase) dès que DATABASE_URL est défini — c'est la
//   seule acceptée hors mode démo ;
// - la mémoire du serveur, uniquement en mode démo sans base (aperçu Lovable,
//   tests) : comptes de démonstration + inscriptions de la session en cours,
//   perdus au redémarrage.

export type AccountStatus = "active" | "pending" | "suspended" | "rejected";
export type StaffRole = "super_admin" | "operations" | "finance" | "support";

export const STAFF_ROLE_LABEL: Record<StaffRole, AdminRoleName> = {
  super_admin: "Super Administrateur",
  operations: "Opérations",
  finance: "Finance",
  support: "Support",
};

export type AccountRecord = {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  /** bcrypt, jamais le mot de passe en clair. */
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  twoFaEnabled: boolean;
  /** Rôle dans l'équipe, pour les comptes administrateurs. */
  staffRole: StaffRole | null;
  lastLoginAt: Date | null;
};

export type ApplicantRole = "farmer" | "restaurant" | "driver";

export type NewApplicant = {
  role: ApplicantRole;
  email: string;
  phone: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  city: string;
  details: RegisterDetails;
  acceptedTermsAt: Date;
};

export type ApplicationStatus = "pending" | "needs_correction" | "approved" | "rejected";
export type ApplicationDecision = "approve" | "reject" | "needs_correction";

/** Dossier d'inscription tel que l'admin le voit. Dates en ISO. */
export type Application = {
  id: string;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
  account: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    role: ApplicantRole;
    status: AccountStatus;
  };
  submitted: { city: string | null; details: RegisterDetails };
};

export type AuditEntry = {
  actorId?: string | null;
  module: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status?: "success" | "failed" | "blocked" | "cancelled";
  before?: unknown;
  after?: unknown;
};

/** Choix proposés par le formulaire d'inscription. `null` : la source n'en
 * impose pas (mode démo), le formulaire garde ses listes habituelles. */
export type RegistrationOptions = { cities: string[]; zones: string[] } | null;

export type CreateApplicantResult =
  | { ok: true; account: AccountRecord; applicationId: string }
  | { ok: false; reason: "email_taken" | "phone_taken" };

export type DecideResult =
  { ok: true; application: Application } | { ok: false; reason: "not_found" | "already_decided" };

export interface AccountStore {
  readonly kind: "database" | "memory";
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountRecord | null>;
  emailTaken(email: string): Promise<boolean>;
  phoneTaken(phone: string): Promise<boolean>;
  /** Compte « en attente » + profil métier + dossier de validation. */
  createApplicant(input: NewApplicant): Promise<CreateApplicantResult>;
  setPasswordHash(userId: string, hash: string): Promise<void>;
  recordLogin(userId: string): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
  registrationsOpen(): Promise<boolean>;
  registrationOptions(): Promise<RegistrationOptions>;
  listApplications(): Promise<Application[]>;
  getApplication(id: string): Promise<Application | null>;
  /** Dernier dossier d'un compte (motif d'une demande de correction…). */
  latestApplicationFor(userId: string): Promise<Application | null>;
  decideApplication(input: {
    id: string;
    decision: ApplicationDecision;
    note?: string;
    actorId: string;
  }): Promise<DecideResult>;
}

export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL?.trim();
}

/**
 * Ouvre l'annuaire le temps d'une requête. Avec la base, la connexion est
 * ouverte puis fermée ici : sur Cloudflare Workers, une connexion ne peut pas
 * servir à deux requêtes.
 */
export async function withAccountStore<T>(fn: (store: AccountStore) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { db, close } = createDb(url);
    try {
      return await fn(new DbAccountStore(db));
    } finally {
      await close();
    }
  }
  if (isDemoMode()) return fn(memoryAccountStore);
  throw new Error(
    "DATABASE_URL manquant : hors mode démo, les comptes doivent être enregistrés dans la base.",
  );
}
