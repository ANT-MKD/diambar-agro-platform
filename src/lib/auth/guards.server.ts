import { authSession } from "./session.server";
import { accountStatus, findAccount, toCurrentUser, type CurrentUser } from "./accounts.server";

/** Vérifie côté serveur qu'un administrateur actif est connecté. À appeler au
 * début de toute fonction serveur réservée à l'administration. */
export async function requireAdminSession(): Promise<CurrentUser> {
  const session = await authSession();
  const account = session.data.email ? findAccount(session.data.email) : undefined;
  if (
    !account ||
    account.role !== "admin" ||
    session.data.role !== "admin" ||
    accountStatus(account.email) !== "active"
  ) {
    throw new Error("Accès réservé à l'administration.");
  }
  return toCurrentUser(account);
}
