import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { demoAccounts } from "@/data/demo-accounts";
import type { DemoAccount } from "@/data/demo-accounts";
import { platformUsers } from "@/data/admin-mocks";
import type { Role } from "@/data/mocks";
import { authSession } from "./session.server";
import { dashboardPathForRole } from "./roles";
import { createSignedToken, verifySignedToken } from "./tokens.server";

export type CurrentUser = {
  email: string;
  role: Role;
  name: string;
  avatar: string;
};

// --- État serveur "démo" (mémoire du process) --------------------------
// Sans base de données, ces deux structures sont ce qui permet au parcours
// de rester réel d'un bout à l'autre (inscription -> connexion, mot de passe
// oublié -> nouveau mot de passe) au lieu de toujours réussir sans rien
// changer. Elles ne survivent pas à un redémarrage du serveur ni ne sont
// partagées entre plusieurs instances — la vraie persistance (Phase 5 :
// base de données) reste nécessaire avant une mise en production.
const demoAccountsRuntime: DemoAccount[] = [];
const demoPasswordOverrides = new Map<string, string>();

function findAccount(email: string): DemoAccount | undefined {
  return (
    demoAccounts.find((a) => a.email === email) ??
    demoAccountsRuntime.find((a) => a.email === email)
  );
}

function effectivePassword(account: DemoAccount): string {
  return demoPasswordOverrides.get(account.email) ?? account.password;
}

function accountToCurrentUser(email: string, role: Role): CurrentUser | null {
  const account = [...demoAccounts, ...demoAccountsRuntime].find(
    (a) => a.email === email && a.role === role,
  );
  if (!account) return null;
  return { email: account.email, role: account.role, name: account.name, avatar: account.avatar };
}

/** Statut réel du compte, dérivé de l'annuaire PlatformUser (admin-mocks.ts).
 * Un compte absent de cet annuaire (ex. les comptes de démo historiques, ou
 * un compte tout juste inscrit dans cette session) est considéré actif par
 * défaut plutôt que bloqué. */
function accountStatus(email: string): "active" | "pending" | "suspended" | "rejected" {
  const record = platformUsers.find((u) => u.email === email);
  return record?.status ?? "active";
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const session = await authSession();
    if (!session.data.email || !session.data.role) return null;
    return accountToCurrentUser(session.data.email, session.data.role);
  },
);

export type LoginResult =
  | { kind: "success"; user: CurrentUser }
  | { kind: "needs_two_fa"; email: string; devCode: string }
  | { kind: "blocked"; reason: "pending" | "suspended" | "rejected" };

export const loginFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; rememberMe?: boolean }) => {
    if (!input.email || !input.password) {
      throw new Error("Email et mot de passe requis");
    }
    return input;
  })
  .handler(async ({ data }): Promise<LoginResult> => {
    const account = findAccount(data.email);
    if (!account || effectivePassword(account) !== data.password) {
      throw new Error("Email ou mot de passe incorrect");
    }

    const status = accountStatus(account.email);
    if (status !== "active") {
      return { kind: "blocked", reason: status };
    }

    if (account.twoFaEnabled) {
      const code = generateCode();
      const session = await authSession(data.rememberMe ?? false);
      await session.update({
        pendingTwoFa: {
          email: account.email,
          role: account.role,
          code,
          expiresAt: Date.now() + 5 * 60_000,
          rememberMe: data.rememberMe ?? false,
        },
      });
      return { kind: "needs_two_fa", email: account.email, devCode: code };
    }

    const session = await authSession(data.rememberMe ?? false);
    await session.update({ email: account.email, role: account.role, pendingTwoFa: undefined });
    const user = accountToCurrentUser(account.email, account.role);
    if (!user) throw new Error("Compte introuvable");
    return { kind: "success", user };
  });

export const verifyTwoFaFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<CurrentUser> => {
    const session = await authSession();
    const pending = session.data.pendingTwoFa;
    if (!pending) throw new Error("Aucune vérification en attente. Reconnectez-vous.");
    if (Date.now() > pending.expiresAt) throw new Error("Code expiré. Reconnectez-vous.");
    if (data.code.trim() !== pending.code) throw new Error("Code incorrect");

    const finalSession = await authSession(pending.rememberMe);
    await finalSession.update({
      email: pending.email,
      role: pending.role,
      pendingTwoFa: undefined,
    });
    const user = accountToCurrentUser(pending.email, pending.role);
    if (!user) throw new Error("Compte introuvable");
    return user;
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

// --- Mot de passe oublié -------------------------------------------------

type ResetTokenPayload = { email: string };

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }): Promise<{ devResetLink: string }> => {
    // Le jeton est toujours généré, que le compte existe ou non : la réponse
    // ne doit jamais permettre de deviner si une adresse est inscrite.
    const token = await createSignedToken<ResetTokenPayload>({ email: data.email }, 30 * 60_000);
    return { devResetLink: `/reset-password?token=${token}` };
  });

export const validateResetTokenFn = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<{ valid: boolean; email?: string }> => {
    const payload = await verifySignedToken<ResetTokenPayload>(data.token);
    return { valid: !!payload, email: payload?.email };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { token: string; password: string }) => {
    if (input.password.length < 8) {
      throw new Error("8 caractères minimum");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const payload = await verifySignedToken<ResetTokenPayload>(data.token);
    if (!payload) throw new Error("Ce lien de récupération a expiré.");
    // Compte inconnu : on répond quand même "ok" sans rien faire, pour ne
    // jamais révéler par ce canal qu'une adresse n'est pas inscrite.
    if (findAccount(payload.email)) {
      demoPasswordOverrides.set(payload.email, data.password);
    }
    return { ok: true };
  });

// --- Inscription -----------------------------------------------------------

const registerSchema = z.object({
  role: z.enum(["farmer", "restaurant", "driver"]),
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(8, "Téléphone invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  city: z.string().min(1),
});

export const registerValidateFn = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof registerSchema>) => registerSchema.parse(input))
  .handler(async ({ data }): Promise<{ devCode: string }> => {
    const emailTaken = findAccount(data.email) || platformUsers.some((u) => u.email === data.email);
    if (emailTaken) throw new Error("Un compte existe déjà avec cet email.");
    const phoneTaken = platformUsers.some((u) =>
      u.phone.replace(/\s/g, "").endsWith(data.phone.replace(/\s/g, "")),
    );
    if (phoneTaken) throw new Error("Ce numéro semble déjà associé à un compte.");

    const code = generateCode();
    const session = await authSession();
    await session.update({
      pendingRegistration: { ...data, code, expiresAt: Date.now() + 10 * 60_000 },
    });
    return { devCode: code };
  });

export const registerVerifyFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<CurrentUser> => {
    const session = await authSession();
    const pending = session.data.pendingRegistration;
    if (!pending) throw new Error("Aucune inscription en attente. Recommencez.");
    if (Date.now() > pending.expiresAt) throw new Error("Code expiré. Recommencez l'inscription.");
    if (data.code.trim() !== pending.code) throw new Error("Code incorrect");

    const account: DemoAccount = {
      role: pending.role,
      email: pending.email,
      password: pending.password,
      name: `${pending.firstName} ${pending.lastName}`,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(pending.firstName)}`,
      emoji: pending.role === "farmer" ? "🌾" : pending.role === "restaurant" ? "🍽️" : "🚚",
      tone: "from-primary/20 to-primary/0 border-primary/40 text-primary",
    };
    demoAccountsRuntime.push(account);

    await session.update({
      email: account.email,
      role: account.role,
      pendingRegistration: undefined,
    });
    return { email: account.email, role: account.role, name: account.name, avatar: account.avatar };
  });
