import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { demoAccounts } from "@/data/demo-accounts";
import type { Role } from "@/data/mocks";
import { authSession } from "./session.server";
import { dashboardPathForRole } from "./roles";

export type CurrentUser = {
  email: string;
  role: Role;
  name: string;
  avatar: string;
};

function accountToCurrentUser(email: string, role: Role): CurrentUser | null {
  const account = demoAccounts.find((a) => a.email === email && a.role === role);
  if (!account) return null;
  return { email: account.email, role: account.role, name: account.name, avatar: account.avatar };
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const session = await authSession();
    if (!session.data.email || !session.data.role) return null;
    return accountToCurrentUser(session.data.email, session.data.role);
  },
);

export const loginFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    if (!input.email || !input.password) {
      throw new Error("Email et mot de passe requis");
    }
    return input;
  })
  .handler(async ({ data }): Promise<CurrentUser> => {
    const account = demoAccounts.find(
      (a) => a.email === data.email && a.password === data.password,
    );
    if (!account) {
      throw new Error("Email ou mot de passe incorrect");
    }
    const session = await authSession();
    await session.update({ email: account.email, role: account.role });
    return { email: account.email, role: account.role, name: account.name, avatar: account.avatar };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await authSession();
  await session.clear();
});

/**
 * À utiliser dans le `beforeLoad` d'un layout de rôle. Redirige vers /login
 * si non authentifié, ou vers le tableau de bord du bon rôle si l'utilisateur
 * est connecté mais n'a pas accès à cette section.
 */
export async function requireRole(role: Role): Promise<{ user: CurrentUser }> {
  const user = await getCurrentUserFn();
  if (!user) {
    throw redirect({ to: "/login" });
  }
  if (user.role !== role) {
    throw redirect({ to: dashboardPathForRole(user.role) });
  }
  return { user };
}
