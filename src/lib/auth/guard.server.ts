import { passwordVersion } from "./accounts.server";
import { authSession } from "./session.server";
import type { AccountRecord, AccountStore, StaffRole } from "./store.server";

/** Compte de la session en cours, s'il est toujours actif, du bon rôle et
 * que son mot de passe n'a pas changé depuis l'ouverture de la session. */
export async function sessionAccount(store: AccountStore): Promise<AccountRecord | null> {
  const session = await authSession();
  const { email, role, pv } = session.data;
  if (!email || !role) return null;
  const account = await store.findByEmail(email);
  // Un compte suspendu, refusé ou disparu perd l'accès tout de suite, même
  // avec une session « Se souvenir de moi » encore valide.
  if (
    !account ||
    account.role !== role ||
    account.status !== "active" ||
    !pv ||
    pv !== (await passwordVersion(account.passwordHash))
  ) {
    await session.clear();
    return null;
  }
  return account;
}

/** Compte connecté, quel que soit son rôle (Paramètres → Sécurité). */
export async function requireAccount(store: AccountStore): Promise<AccountRecord> {
  const account = await sessionAccount(store);
  if (!account) throw new Error("Session expirée. Reconnectez-vous.");
  return account;
}

/**
 * Garde des fonctions serveur réservées à l'équipe : le contrôle se fait ici,
 * côté serveur, et pas seulement en masquant des boutons à l'écran.
 */
export async function requireStaff(
  store: AccountStore,
  allowed?: StaffRole[],
): Promise<AccountRecord> {
  const account = await sessionAccount(store);
  if (!account || account.role !== "admin") throw new Error("Accès réservé à l'administration.");
  if (allowed && (!account.staffRole || !allowed.includes(account.staffRole))) {
    throw new Error("Votre rôle ne permet pas cette action.");
  }
  return account;
}
