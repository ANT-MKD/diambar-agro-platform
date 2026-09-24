import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import type { Role } from "@/data/mocks";
import type { DemoAccount } from "@/data/demo-accounts";
import { authSession } from "./session.server";
import { dashboardPathForRole } from "./roles";
import { createSignedToken, verifySignedToken } from "./tokens.server";
import { deliverCode, deliverResetLink, isDemoMode } from "./config.server";
import {
  accountStatus,
  checkPassword,
  createAccount,
  emailTaken,
  findAccount,
  findDemoAccount,
  phoneTaken,
  publicDemoAccounts,
  setPassword,
  toCurrentUser,
  type CurrentUser,
  type PublicDemoAccount,
} from "./accounts.server";
import {
  AttemptLimiter,
  generateSixDigitCode,
  normalizeEmail,
  normalizeSenegalPhone,
  registerDetailsProblem,
  safeEqual,
} from "./helpers";

export type { CurrentUser, PublicDemoAccount };

// --- Limites côté serveur ---------------------------------------------------
// Le blocage ne dépend plus du navigateur : changer de navigateur ou vider ses
// données ne remet pas les compteurs à zéro. (Compteurs en mémoire de
// l'instance ; un compteur partagé arrive avec la base de données.)
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_CODE_ATTEMPTS = 5;
const CODE_TTL_2FA_MS = 5 * 60_000;
const CODE_TTL_REGISTER_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;

const loginLimiter = new AttemptLimiter(MAX_LOGIN_FAILURES, LOGIN_WINDOW_MS);
// Clé = identifiant du code en cours : rejouer un ancien cookie ne redonne pas d'essais.
const codeLimiter = new AttemptLimiter(MAX_CODE_ATTEMPTS, CODE_TTL_REGISTER_MS);
const resetRequestLimiter = new AttemptLimiter(3, LOGIN_WINDOW_MS);
// Liens de réinitialisation déjà utilisés (usage unique).
const usedResetTokens = new Set<string>();

function randomId(): string {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function secondsUntilResend(sentAt: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000));
}

function attemptsLeftMessage(left: number): string {
  return `Code incorrect. ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.`;
}

// --- Configuration affichée par les écrans -----------------------------------

export type AuthConfig = { demoMode: boolean; demoAccounts: PublicDemoAccount[] };

export const getAuthConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthConfig> => {
    const demoMode = isDemoMode();
    return { demoMode, demoAccounts: demoMode ? publicDemoAccounts() : [] };
  },
);

// --- Session ------------------------------------------------------------------

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const session = await authSession();
    if (!session.data.email || !session.data.role) return null;
    const account = findAccount(session.data.email);
    // Un compte suspendu, refusé ou disparu perd l'accès tout de suite, même
    // avec une session « Se souvenir de moi » encore valide.
    if (
      !account ||
      account.role !== session.data.role ||
      accountStatus(account.email) !== "active"
    ) {
      await session.clear();
      return null;
    }
    return toCurrentUser(account);
  },
);

export type LoginResult =
  | { kind: "success"; user: CurrentUser }
  | { kind: "needs_two_fa"; email: string; devCode?: string; resendInSeconds: number }
  | { kind: "blocked"; reason: "pending" | "suspended" | "rejected" }
  | { kind: "invalid"; remaining: number }
  | { kind: "locked"; minutes: number };

/** Ouvre la session (ou démarre la double authentification) pour un compte
 * dont l'identité est déjà prouvée. */
async function startSession(account: DemoAccount, rememberMe: boolean): Promise<LoginResult> {
  const status = accountStatus(account.email);
  if (status !== "active") return { kind: "blocked", reason: status };

  const session = await authSession(rememberMe);
  if (account.twoFaEnabled) {
    const code = generateSixDigitCode();
    const now = Date.now();
    await session.update({
      pendingTwoFa: {
        id: randomId(),
        email: account.email,
        role: account.role,
        code,
        expiresAt: now + CODE_TTL_2FA_MS,
        sentAt: now,
        attempts: 0,
        rememberMe,
      },
    });
    const { devCode } = deliverCode("double authentification", account.email, code);
    return {
      kind: "needs_two_fa",
      email: account.email,
      devCode,
      resendInSeconds: RESEND_COOLDOWN_MS / 1000,
    };
  }

  await session.update({ email: account.email, role: account.role, pendingTwoFa: undefined });
  return { kind: "success", user: toCurrentUser(account) };
}

export const loginFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; rememberMe?: boolean }) => {
    if (!input.email || !input.password) throw new Error("Email et mot de passe requis");
    return { ...input, email: normalizeEmail(input.email) };
  })
  .handler(async ({ data }): Promise<LoginResult> => {
    // Vérifié avant le mot de passe : un bon mot de passe ne lève pas le blocage.
    const minutes = loginLimiter.lockedMinutes(data.email);
    if (minutes > 0) return { kind: "locked", minutes };

    const account = findAccount(data.email);
    if (!account || !checkPassword(account, data.password)) {
      loginLimiter.fail(data.email);
      const lockedNow = loginLimiter.lockedMinutes(data.email);
      if (lockedNow > 0) return { kind: "locked", minutes: lockedNow };
      return { kind: "invalid", remaining: loginLimiter.remaining(data.email) };
    }
    loginLimiter.reset(data.email);
    return startSession(account, data.rememberMe ?? false);
  });

/** Connexion en un clic, réservée aux comptes de démonstration et au mode démo :
 * les mots de passe de démo ne quittent jamais le serveur. */
export const demoLoginFn = createServerFn({ method: "POST" })
  .validator((input: { email: string; rememberMe?: boolean }) => input)
  .handler(async ({ data }): Promise<LoginResult> => {
    if (!isDemoMode()) throw new Error("Connexion de démonstration désactivée.");
    const account = findDemoAccount(data.email);
    if (!account) throw new Error("Compte de démonstration inconnu.");
    return startSession(account, data.rememberMe ?? false);
  });

export type CodeCheckResult =
  { ok: true; user: CurrentUser } | { ok: false; message: string; restart?: boolean };

const TOO_MANY_2FA = "Trop d'essais. Reconnectez-vous pour recevoir un nouveau code.";

export const verifyTwoFaFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<CodeCheckResult> => {
    const session = await authSession();
    const pending = session.data.pendingTwoFa;
    if (!pending) {
      return {
        ok: false,
        restart: true,
        message: "Aucune vérification en attente. Reconnectez-vous.",
      };
    }
    if (Date.now() > pending.expiresAt) {
      await session.update({ pendingTwoFa: undefined });
      return { ok: false, restart: true, message: "Code expiré. Reconnectez-vous." };
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS || codeLimiter.lockedMinutes(pending.id) > 0) {
      await session.update({ pendingTwoFa: undefined });
      return { ok: false, restart: true, message: TOO_MANY_2FA };
    }
    if (!safeEqual(data.code.trim(), pending.code)) {
      codeLimiter.fail(pending.id);
      const attempts = pending.attempts + 1;
      const left = Math.min(MAX_CODE_ATTEMPTS - attempts, codeLimiter.remaining(pending.id));
      if (left <= 0) {
        await session.update({ pendingTwoFa: undefined });
        return { ok: false, restart: true, message: TOO_MANY_2FA };
      }
      await session.update({ pendingTwoFa: { ...pending, attempts } });
      return { ok: false, message: attemptsLeftMessage(left) };
    }

    codeLimiter.reset(pending.id);
    const account = findAccount(pending.email);
    if (!account || accountStatus(account.email) !== "active") {
      await session.update({ pendingTwoFa: undefined });
      return { ok: false, restart: true, message: "Ce compte n'est plus accessible." };
    }
    const finalSession = await authSession(pending.rememberMe);
    await finalSession.update({
      email: account.email,
      role: account.role,
      pendingTwoFa: undefined,
    });
    return { ok: true, user: toCurrentUser(account) };
  });

export type ResendResult =
  | { ok: true; devCode?: string; resendInSeconds: number }
  | { ok: false; message: string; waitSeconds?: number };

export const resendTwoFaFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResendResult> => {
    const session = await authSession();
    const pending = session.data.pendingTwoFa;
    if (!pending) {
      return { ok: false, message: "Aucune vérification en attente. Reconnectez-vous." };
    }
    const wait = secondsUntilResend(pending.sentAt);
    if (wait > 0) return { ok: false, waitSeconds: wait, message: `Patientez ${wait} s.` };
    const code = generateSixDigitCode();
    const now = Date.now();
    await session.update({
      pendingTwoFa: {
        ...pending,
        id: randomId(),
        code,
        sentAt: now,
        expiresAt: now + CODE_TTL_2FA_MS,
        attempts: 0,
      },
    });
    const { devCode } = deliverCode("double authentification", pending.email, code);
    return { ok: true, devCode, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  },
);

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

type ResetTokenPayload = { email: string; jti: string };
const RESET_TTL_MS = 30 * 60_000;

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => ({ email: normalizeEmail(input.email) }))
  .handler(async ({ data }): Promise<{ devResetLink?: string }> => {
    // La réponse est la même que le compte existe ou non (et au-delà de
    // 3 demandes par quart d'heure) : elle ne permet pas de deviner si une
    // adresse est inscrite.
    if (resetRequestLimiter.lockedMinutes(data.email) > 0) return {};
    resetRequestLimiter.fail(data.email);
    const token = await createSignedToken<ResetTokenPayload>(
      { email: data.email, jti: randomId() },
      RESET_TTL_MS,
    );
    return deliverResetLink(data.email, `/reset-password?token=${token}`);
  });

export type ResetTokenState = { valid: boolean; reason?: "missing" | "expired" | "used" };

async function readResetToken(
  token: string,
): Promise<ResetTokenState & { payload?: ResetTokenPayload }> {
  if (!token) return { valid: false, reason: "missing" };
  const payload = await verifySignedToken<ResetTokenPayload>(token);
  if (!payload || !payload.jti) return { valid: false, reason: "expired" };
  if (usedResetTokens.has(payload.jti)) return { valid: false, reason: "used" };
  return { valid: true, payload };
}

export const validateResetTokenFn = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<ResetTokenState> => {
    const { valid, reason } = await readResetToken(data.token);
    return { valid, reason };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .validator((input: { token: string; password: string }) => {
    if (input.password.length < 8) throw new Error("8 caractères minimum");
    if (input.password.length > 128) throw new Error("128 caractères maximum");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const state = await readResetToken(data.token);
    if (!state.valid || !state.payload) {
      throw new Error(
        state.reason === "used"
          ? "Ce lien a déjà été utilisé. Demandez-en un nouveau."
          : "Ce lien de récupération a expiré.",
      );
    }
    usedResetTokens.add(state.payload.jti);
    // Compte inconnu : on répond quand même "ok" sans rien faire, pour ne
    // jamais révéler par ce canal qu'une adresse n'est pas inscrite.
    setPassword(state.payload.email, data.password);
    loginLimiter.reset(state.payload.email);
    return { ok: true };
  });

// --- Inscription -----------------------------------------------------------

const registerDetailsSchema = z
  .object({
    farmName: z.string().optional(),
    location: z.string().optional(),
    areaHectares: z.string().optional(),
    productTypes: z.array(z.string()).optional(),
    restaurantName: z.string().optional(),
    address: z.string().optional(),
    professionalPhone: z.string().optional(),
    ninea: z.string().optional(),
    vehicleType: z.string().optional(),
    licenseNumber: z.string().optional(),
    zones: z.array(z.string()).optional(),
  })
  .optional();

const registerSchema = z
  .object({
    role: z.enum(["farmer", "restaurant", "driver"]),
    firstName: z.string().trim().min(2, "Prénom requis"),
    lastName: z.string().trim().min(2, "Nom requis"),
    email: z.string().trim().email("Email invalide"),
    phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
      message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
    }),
    password: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
    city: z.string().min(1, "Ville requise"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Acceptez les conditions générales pour continuer" }),
    }),
    details: registerDetailsSchema,
  })
  .superRefine((data, ctx) => {
    const problem = registerDetailsProblem(data.role, data.details ?? {});
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem, path: ["details"] });
  });

export type RegisterStartResult =
  { ok: true; devCode?: string; resendInSeconds: number } | { ok: false; message: string };

export const registerValidateFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof registerSchema>) => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<RegisterStartResult> => {
    const email = normalizeEmail(data.email);
    if (emailTaken(email)) return { ok: false, message: "Un compte existe déjà avec cet email." };
    if (phoneTaken(data.phone)) {
      return { ok: false, message: "Ce numéro est déjà associé à un compte." };
    }
    const phone = normalizeSenegalPhone(data.phone)!;

    const code = generateSixDigitCode();
    const now = Date.now();
    const session = await authSession();
    await session.update({
      pendingRegistration: {
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        phone,
        password: data.password,
        city: data.city,
        details: data.details,
        acceptedTermsAt: new Date(now).toISOString(),
        id: randomId(),
        code,
        sentAt: now,
        expiresAt: now + CODE_TTL_REGISTER_MS,
        attempts: 0,
      },
    });
    const { devCode } = deliverCode("inscription", `+221 ${phone}`, code);
    return { ok: true, devCode, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  });

export const resendRegistrationCodeFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResendResult> => {
    const session = await authSession();
    const pending = session.data.pendingRegistration;
    if (!pending) return { ok: false, message: "Aucune inscription en attente. Recommencez." };
    const wait = secondsUntilResend(pending.sentAt);
    if (wait > 0) return { ok: false, waitSeconds: wait, message: `Patientez ${wait} s.` };
    const code = generateSixDigitCode();
    const now = Date.now();
    await session.update({
      pendingRegistration: {
        ...pending,
        id: randomId(),
        code,
        sentAt: now,
        expiresAt: now + CODE_TTL_REGISTER_MS,
        attempts: 0,
      },
    });
    const { devCode } = deliverCode("inscription", `+221 ${pending.phone}`, code);
    return { ok: true, devCode, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  },
);

export const registerVerifyFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<CodeCheckResult> => {
    const session = await authSession();
    const pending = session.data.pendingRegistration;
    if (!pending) {
      return { ok: false, restart: true, message: "Aucune inscription en attente. Recommencez." };
    }
    if (Date.now() > pending.expiresAt) {
      return { ok: false, message: "Code expiré. Demandez un nouveau code." };
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS || codeLimiter.lockedMinutes(pending.id) > 0) {
      return { ok: false, message: "Trop d'essais. Demandez un nouveau code." };
    }
    if (!safeEqual(data.code.trim(), pending.code)) {
      codeLimiter.fail(pending.id);
      const attempts = pending.attempts + 1;
      await session.update({ pendingRegistration: { ...pending, attempts } });
      const left = Math.min(MAX_CODE_ATTEMPTS - attempts, codeLimiter.remaining(pending.id));
      return {
        ok: false,
        message: left > 0 ? attemptsLeftMessage(left) : "Trop d'essais. Demandez un nouveau code.",
      };
    }
    // L'email a pu être pris entre-temps (autre onglet, autre personne).
    if (emailTaken(pending.email)) {
      await session.update({ pendingRegistration: undefined });
      return { ok: false, restart: true, message: "Un compte existe déjà avec cet email." };
    }

    codeLimiter.reset(pending.id);
    const account = createAccount({
      role: pending.role,
      email: pending.email,
      password: pending.password,
      firstName: pending.firstName,
      lastName: pending.lastName,
      details: pending.details,
      acceptedTermsAt: pending.acceptedTermsAt,
    });
    await session.update({
      email: account.email,
      role: account.role,
      pendingRegistration: undefined,
    });
    return { ok: true, user: toCurrentUser(account) };
  });
