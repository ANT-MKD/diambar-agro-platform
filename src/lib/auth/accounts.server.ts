import { demoAccounts } from "@/data/demo-accounts";
import type { DemoAccount } from "@/data/demo-accounts";
import type { Role } from "@/data/mocks";
import type { AdminRoleName } from "@/data/admin-mocks";
import { normalizeEmail } from "./helpers";
import type { PermissionKey } from "./permissions";
import type { AccountRecord } from "./store.server";

/** Coût bcrypt des mots de passe enregistrés (≈ 70 ms par vérification). */
export const BCRYPT_COST = 10;

// Ce qui sort de l'annuaire vers les écrans. Ce module n'est importé que par
// du code serveur : ni mot de passe ni empreinte ne partent au navigateur.

export type CurrentUser = {
  email: string;
  role: Role;
  name: string;
  avatar: string;
  /** Rôle dans l'équipe d'administration, lu dans l'annuaire (comptes admin). */
  adminRole?: AdminRoleName;
  /** Permissions de ce rôle (le serveur les vérifie à chaque action). */
  adminPermissions?: PermissionKey[];
};

function findDemo(email: string): DemoAccount | undefined {
  const key = normalizeEmail(email);
  return demoAccounts.find((a) => normalizeEmail(a.email) === key);
}

export function isDemoEmail(email: string): boolean {
  return !!findDemo(email);
}

export function toCurrentUser(account: AccountRecord): CurrentUser {
  const demo = findDemo(account.email);
  const name = demo?.name ?? `${account.firstName} ${account.lastName}`.trim();
  return {
    email: account.email,
    role: account.role,
    name,
    avatar:
      demo?.avatar ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    ...(account.role === "admin" && account.staffRoleName
      ? { adminRole: account.staffRoleName, adminPermissions: account.permissions }
      : {}),
  };
}

/**
 * Empreinte courte du mot de passe enregistré. Gardée dans la session et dans
 * les liens de réinitialisation : changer de mot de passe invalide aussitôt
 * les autres sessions et les liens déjà envoyés.
 */
export async function passwordVersion(passwordHash: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(passwordHash));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Ce que la page de connexion peut afficher d'un compte de démonstration —
 * jamais le mot de passe. */
export type PublicDemoAccount = Pick<
  DemoAccount,
  "email" | "role" | "name" | "emoji" | "tone" | "label" | "kind"
>;

export function publicDemoAccount({
  email,
  role,
  name,
  emoji,
  tone,
  label,
  kind,
}: DemoAccount): PublicDemoAccount {
  return { email, role, name, emoji, tone, label, kind };
}

export { demoAccounts };
