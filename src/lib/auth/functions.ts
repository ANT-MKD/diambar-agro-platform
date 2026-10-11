import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import type { Role } from "@/data/mocks";
import { authSession } from "./session.server";
import { dashboardPathForRole } from "./roles";
import { createSignedToken, verifySignedToken } from "./tokens.server";
import { deliverCode, deliverResetLink, isDemoMode } from "./config.server";
import { sessionAccount } from "./guard.server";
import {
  BCRYPT_COST,
  demoAccounts,
  isDemoEmail,
  passwordVersion,
  publicDemoAccount,
  toCurrentUser,
  type CurrentUser,
  type PublicDemoAccount,
} from "./accounts.server";
import {
  withAccountStore,
  type AccountRecord,
  type AccountStore,
  type RegistrationOptions,
} from "./store.server";
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
// Le blocage ne dépend pas du navigateur : changer de navigateur ou vider ses
// données ne remet pas les compteurs à zéro. (Compteurs en mémoire de
// l'instance : un compteur partagé entre instances reste à faire.)
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
// Liens de réinitialisation déjà utilisés (en plus de l'empreinte du mot de passe).
const usedResetTokens = new Set<string>();

// Empreinte bcrypt factice : un email inconnu prend le même temps qu'un mauvais
// mot de passe, la durée de réponse ne trahit pas quelles adresses sont inscrites.
const DUMMY_HASH = "$2b$10$oeSELryiypCBhC106evak.8zIfVDc7BIK3rxxkFuZx3OA5sSS2xCi";

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

export type AuthConfig = {
  demoMode: boolean;
  demoAccounts: PublicDemoAccount[];
};

export const getAuthConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthConfig> => {
    const demoMode = isDemoMode();
    if (!demoMode) return { demoMode, demoAccounts: [] };
    // Seuls les comptes de démonstration présents dans l'annuaire sont proposés
    // (une base de production n'en contient aucun).
    const present = await withAccountStore((store) =>
      Promise.all(demoAccounts.map((a) => store.findByEmail(normalizeEmail(a.email)))),
    );
    return {
      demoMode,
      demoAccounts: demoAccounts.filter((_, i) => present[i]).map(publicDemoAccount),
    };
  },
);

export type RegistrationConfig = { open: boolean; options: RegistrationOptions };

export const getRegistrationConfigFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<RegistrationConfig> =>
    withAccountStore(async (store) => {
      const open = await store.registrationsOpen();
      return { open, options: open ? await store.registrationOptions() : null };
    }),
);

// --- Session ------------------------------------------------------------------

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> =>
    withAccountStore(async (store) => {
      const account = await sessionAccount(store);
      return account ? toCurrentUser(account) : null;
    }),
);

export type LoginResult =
  | { kind: "success"; user: CurrentUser }
  | { kind: "needs_two_fa"; email: string; devCode?: string; resendInSeconds: number }
  | { kind: "blocked"; reason: "pending" | "suspended" | "rejected"; note?: string }
  | { kind: "invalid"; remaining: number }
  | { kind: "locked"; minutes: number };

/** Ouvre la session (ou démarre la double authentification) pour un compte
 * dont l'identité est déjà prouvée. */
async function startSession(
  store: AccountStore,
  account: AccountRecord,
  rememberMe: boolean,
): Promise<LoginResult> {
  if (account.status !== "active") {
    await store.audit({
      actorId: account.id,
      module: "auth",
      action: "Connexion refusée (compte non actif)",
      targetType: "user",
      targetId: account.id,
      status: "blocked",
      after: { status: account.status },
    });
    // Une demande de correction de l'admin est montrée à la personne.
    const application =
      account.status === "pending" ? await store.latestApplicationFor(account.id) : null;
    const note =
      application?.status === "needs_correction" ? (application.note ?? undefined) : undefined;
    return { kind: "blocked", reason: account.status, ...(note ? { note } : {}) };
  }

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

  await session.update({
    email: account.email,
    role: account.role,
    pv: await passwordVersion(account.passwordHash),
    pendingTwoFa: undefined,
  });
  await store.recordLogin(account.id);
  await store.audit({
    actorId: account.id,
    module: "auth",
    action: "Connexion",
    targetType: "user",
    targetId: account.id,
  });
  return { kind: "success", user: toCurrentUser(account) };
}

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; rememberMe?: boolean }) => {
    if (!input.email || !input.password) throw new Error("Email et mot de passe requis");
    if (input.password.length > 128) throw new Error("Mot de passe trop long");
    return { ...input, email: normalizeEmail(input.email) };
  })
  .handler(async ({ data }): Promise<LoginResult> => {
    // Vérifié avant le mot de passe : un bon mot de passe ne lève pas le blocage.
    const minutes = loginLimiter.lockedMinutes(data.email);
    if (minutes > 0) return { kind: "locked", minutes };

    return withAccountStore(async (store) => {
      const account = await store.findByEmail(data.email);
      const matches = await compare(data.password, account?.passwordHash ?? DUMMY_HASH);
      if (!account || !matches) {
        loginLimiter.fail(data.email);
        if (account) {
          await store.audit({
            actorId: null,
            module: "auth",
            action: "Échec de connexion (mot de passe)",
            targetType: "user",
            targetId: account.id,
            status: "failed",
          });
        }
        const lockedNow = loginLimiter.lockedMinutes(data.email);
        if (lockedNow > 0) return { kind: "locked", minutes: lockedNow };
        return { kind: "invalid", remaining: loginLimiter.remaining(data.email) };
      }
      loginLimiter.reset(data.email);
      return startSession(store, account, data.rememberMe ?? false);
    });
  });

/** Connexion en un clic, réservée aux comptes de démonstration et au mode démo :
 * les mots de passe de démo ne quittent jamais le serveur. */
export const demoLoginFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; rememberMe?: boolean }) => ({
    ...input,
    email: normalizeEmail(input.email),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    if (!isDemoMode()) throw new Error("Connexion de démonstration désactivée.");
    if (!isDemoEmail(data.email)) throw new Error("Compte de démonstration inconnu.");
    return withAccountStore(async (store) => {
      const account = await store.findByEmail(data.email);
      if (!account) throw new Error("Compte de démonstration absent de l'annuaire.");
      return startSession(store, account, data.rememberMe ?? false);
    });
  });

export type CodeCheckResult =
  { ok: true; user: CurrentUser } | { ok: false; message: string; restart?: boolean };

const TOO_MANY_2FA = "Trop d'essais. Reconnectez-vous pour recevoir un nouveau code.";

export const verifyTwoFaFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
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
    return withAccountStore(async (store) => {
      const account = await store.findByEmail(pending.email);
      if (!account || account.status !== "active" || account.role !== pending.role) {
        await session.update({ pendingTwoFa: undefined });
        return { ok: false, restart: true, message: "Ce compte n'est plus accessible." };
      }
      const finalSession = await authSession(pending.rememberMe);
      await finalSession.update({
        email: account.email,
        role: account.role,
        pv: await passwordVersion(account.passwordHash),
        pendingTwoFa: undefined,
      });
      await store.recordLogin(account.id);
      await store.audit({
        actorId: account.id,
        module: "auth",
        action: "Connexion (double authentification)",
        targetType: "user",
        targetId: account.id,
      });
      return { ok: true, user: toCurrentUser(account) };
    });
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

type ResetTokenPayload = { email: string; jti: string; pv: string };
const RESET_TTL_MS = 30 * 60_000;

export const requestPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({ email: normalizeEmail(input.email) }))
  .handler(async ({ data }): Promise<{ devResetLink?: string }> => {
    // La réponse est la même que le compte existe ou non (et au-delà de
    // 3 demandes par quart d'heure) : elle ne permet pas de deviner si une
    // adresse est inscrite.
    if (resetRequestLimiter.lockedMinutes(data.email) > 0) return {};
    resetRequestLimiter.fail(data.email);
    const account = await withAccountStore((store) => store.findByEmail(data.email));
    const token = await createSignedToken<ResetTokenPayload>(
      {
        email: data.email,
        jti: randomId(),
        // Lien lié au mot de passe actuel : il ne sert qu'une fois.
        pv: account ? await passwordVersion(account.passwordHash) : "none",
      },
      RESET_TTL_MS,
    );
    return deliverResetLink(data.email, `/reset-password?token=${token}`);
  });

export type ResetTokenState = { valid: boolean; reason?: "missing" | "expired" | "used" };

async function readResetToken(
  store: AccountStore,
  token: string,
): Promise<ResetTokenState & { payload?: ResetTokenPayload; account?: AccountRecord | null }> {
  if (!token) return { valid: false, reason: "missing" };
  const payload = await verifySignedToken<ResetTokenPayload>(token);
  if (!payload || !payload.jti || !payload.pv) return { valid: false, reason: "expired" };
  if (usedResetTokens.has(payload.jti)) return { valid: false, reason: "used" };
  const account = await store.findByEmail(payload.email);
  // Mot de passe changé depuis l'envoi du lien : le lien a déjà servi.
  if (account && payload.pv !== (await passwordVersion(account.passwordHash))) {
    return { valid: false, reason: "used" };
  }
  return { valid: true, payload, account };
}

export const validateResetTokenFn = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }): Promise<ResetTokenState> =>
    withAccountStore(async (store) => {
      const { valid, reason } = await readResetToken(store, data.token);
      return { valid, reason };
    }),
  );

export const resetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; password: string }) => {
    if (input.password.length < 8) throw new Error("8 caractères minimum");
    if (input.password.length > 128) throw new Error("128 caractères maximum");
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> =>
    withAccountStore(async (store) => {
      const state = await readResetToken(store, data.token);
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
      if (state.account) {
        await store.setPasswordHash(state.account.id, await hash(data.password, BCRYPT_COST));
        await store.audit({
          actorId: state.account.id,
          module: "auth",
          action: "Mot de passe réinitialisé",
          targetType: "user",
          targetId: state.account.id,
        });
      }
      loginLimiter.reset(state.payload.email);
      return { ok: true };
    }),
  );

// --- Inscription -----------------------------------------------------------

const registerDetailsSchema = z
  .object({
    farmName: z.string().max(120).optional(),
    location: z.string().max(200).optional(),
    areaHectares: z.string().max(20).optional(),
    productTypes: z.array(z.string().max(60)).max(20).optional(),
    restaurantName: z.string().max(120).optional(),
    address: z.string().max(200).optional(),
    professionalPhone: z.string().max(30).optional(),
    ninea: z.string().max(40).optional(),
    vehicleType: z.string().max(40).optional(),
    licenseNumber: z.string().max(40).optional(),
    zones: z.array(z.string().max(80)).max(50).optional(),
  })
  .optional();

const registerSchema = z
  .object({
    role: z.enum(["farmer", "restaurant", "driver"]),
    firstName: z.string().trim().min(2, "Prénom requis").max(60),
    lastName: z.string().trim().min(2, "Nom requis").max(60),
    email: z.string().trim().email("Email invalide").max(200),
    phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
      message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
    }),
    password: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
    city: z.string().min(1, "Ville requise").max(80),
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

const REGISTRATIONS_CLOSED =
  "Les inscriptions ne sont pas encore ouvertes. Revenez bientôt ou contactez-nous.";

export const registerValidateFn = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof registerSchema>) => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<RegisterStartResult> => {
    const email = normalizeEmail(data.email);
    const phone = normalizeSenegalPhone(data.phone)!;
    const problem = await withAccountStore(async (store) => {
      if (!(await store.registrationsOpen())) return REGISTRATIONS_CLOSED;
      const options = await store.registrationOptions();
      if (options) {
        if (!options.cities.includes(data.city)) return "Choisissez une ville de la liste.";
        const unknown = (data.details?.zones ?? []).filter((z) => !options.zones.includes(z));
        if (unknown.length) return "Choisissez vos zones dans la liste proposée.";
      }
      if (await store.emailTaken(email)) return "Un compte existe déjà avec cet email.";
      if (await store.phoneTaken(phone)) return "Ce numéro est déjà associé à un compte.";
      return null;
    });
    if (problem) return { ok: false, message: problem };

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
        passwordHash: await hash(data.password, BCRYPT_COST),
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

export type RegisterVerifyResult =
  { ok: true; firstName: string } | { ok: false; message: string; restart?: boolean };

export const registerVerifyFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data }): Promise<RegisterVerifyResult> => {
    const session = await authSession();
    const pending = session.data.pendingRegistration;
    if (!pending?.passwordHash) {
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
    codeLimiter.reset(pending.id);

    const result = await withAccountStore(async (store) => {
      if (!(await store.registrationsOpen())) return { ok: false as const, reason: "closed" };
      return store.createApplicant({
        role: pending.role,
        email: pending.email,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        firstName: pending.firstName,
        lastName: pending.lastName,
        city: pending.city,
        details: pending.details ?? {},
        acceptedTermsAt: new Date(pending.acceptedTermsAt),
      });
    });
    // Le compte attend la validation de l'équipe : pas de session ouverte.
    await session.update({ pendingRegistration: undefined });
    if (!result.ok) {
      return {
        ok: false,
        restart: true,
        message:
          result.reason === "closed"
            ? REGISTRATIONS_CLOSED
            : result.reason === "phone_taken"
              ? "Ce numéro est déjà associé à un compte."
              : "Un compte existe déjà avec cet email.",
      };
    }
    return { ok: true, firstName: pending.firstName };
  });
