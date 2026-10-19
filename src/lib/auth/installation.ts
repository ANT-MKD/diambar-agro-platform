import { createServerFn } from "@tanstack/react-start";
import { hash } from "bcryptjs";
import { z } from "zod";
import { BCRYPT_COST, passwordVersion, toCurrentUser, type CurrentUser } from "./accounts.server";
import { adminEmail, setupCode } from "./config.server";
import {
  AttemptLimiter,
  generateSixDigitCode,
  normalizeEmail,
  normalizeSenegalPhone,
  safeEqual,
} from "./helpers";
import { authSession, type PendingInstall } from "./session.server";
import { withAccountStore } from "./store.server";
import { emailConfigured, sendEmail } from "@/lib/notify/email.server";
import { installationCodeEmail } from "@/lib/notify/templates";

// Installation : création du premier super administrateur, en étapes comme
// l'inscription. Seule la personne qui déploie peut la faire :
// - méthode « email » : l'adresse doit être celle déclarée dans les réglages
//   du serveur (ADMIN_EMAIL) et elle est confirmée par un code envoyé par
//   email, jamais affiché à l'écran (même en mode démonstration) ;
// - méthode « code » (secours, sans envoi d'emails) : le code secret
//   SETUP_CODE des réglages du serveur.
// La page se ferme pour toujours dès qu'un super administrateur existe.

export type InstallationState =
  | "ready" // base branchée, protection configurée, aucun super admin
  | "installed" // un super admin existe : rien à faire ici
  | "not_configured" // ni ADMIN_EMAIL (avec envoi d'emails) ni SETUP_CODE
  | "no_database"; // mode démo sans base : comptes de démo

export type InstallMethod = "email" | "setup_code";

export type InstallationInfo = {
  state: InstallationState;
  method: InstallMethod | null;
  /** L'envoi d'emails fonctionne (codes de vérification, double authentification). */
  emailReady: boolean;
  /** Étape où reprendre si une installation est en cours dans ce navigateur. */
  resume: "verify" | "password" | null;
  pendingEmail?: string;
};

const CODE_TTL_MS = 10 * 60_000;
/** Après la vérification, le mot de passe doit être choisi dans ce délai. */
const VERIFIED_TTL_MS = 30 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_CODE_ATTEMPTS = 5;
const LIMIT_KEY = "installation";

const installLimiter = new AttemptLimiter(5, 15 * 60_000);
const codeLimiter = new AttemptLimiter(MAX_CODE_ATTEMPTS, CODE_TTL_MS);

function methodOf(): InstallMethod | null {
  if (adminEmail() && emailConfigured()) return "email";
  if (setupCode()) return "setup_code";
  return null;
}

async function currentState(): Promise<InstallationState> {
  return withAccountStore(async (store) => {
    if (store.kind === "memory") return "no_database";
    if (await store.superAdminExists()) return "installed";
    return methodOf() ? "ready" : "not_configured";
  });
}

const ALREADY_INSTALLED = "L'installation est déjà faite. Connectez-vous.";
const NOT_CONFIGURED = "L'installation n'est pas configurée sur ce serveur.";
const RESTART = "Aucune installation en cours. Recommencez depuis le début.";

export const getInstallationStateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<InstallationInfo> => {
    const state = await currentState();
    const info: InstallationInfo = {
      state,
      method: state === "ready" ? methodOf() : null,
      emailReady: emailConfigured(),
      resume: null,
    };
    if (state !== "ready") return info;
    const pending = (await authSession()).data.pendingInstall;
    if (!pending) return info;
    if (pending.verifiedAt && Date.now() - pending.verifiedAt < VERIFIED_TTL_MS) {
      return { ...info, resume: "password", pendingEmail: pending.email };
    }
    if (!pending.verifiedAt && pending.code && Date.now() < pending.expiresAt) {
      return { ...info, resume: "verify", pendingEmail: pending.email };
    }
    return info;
  },
);

async function sendInstallCode(
  p: PendingInstall,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Jamais de code affiché à l'écran ici, même en mode démonstration : c'est
  // la réception de l'email qui prouve qui installe.
  const sent = await sendEmail({
    to: p.email,
    ...installationCodeEmail({ firstName: p.firstName, code: p.code }),
  });
  return sent.ok
    ? { ok: true }
    : {
        ok: false,
        message:
          "L'email n'a pas pu être envoyé. Vérifiez la configuration de l'envoi d'emails (Resend), puis réessayez.",
      };
}

// --- Étape « identité » ------------------------------------------------------------

const identitySchema = z.object({
  firstName: z.string().trim().min(2, "Prénom requis").max(60),
  lastName: z.string().trim().min(2, "Nom requis").max(60),
  email: z.string().trim().email("Email invalide").max(200),
  phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
    message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
  }),
  /** Méthode « code » seulement. */
  setupCode: z.string().max(200).optional(),
});

export type InstallStartResult =
  | { ok: true; next: "verify" | "password"; resendInSeconds: number }
  | { ok: false; message: string };

export const installStartFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof identitySchema>) => {
    const parsed = identitySchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<InstallStartResult> => {
    const minutes = installLimiter.lockedMinutes(LIMIT_KEY);
    if (minutes > 0) {
      return { ok: false, message: `Trop d'essais. Réessayez dans ${minutes} minute(s).` };
    }
    const state = await currentState();
    if (state === "installed") return { ok: false, message: ALREADY_INSTALLED };
    const method = methodOf();
    if (state !== "ready" || !method) return { ok: false, message: NOT_CONFIGURED };

    const email = normalizeEmail(data.email);
    const phone = normalizeSenegalPhone(data.phone)!;
    if (method === "email") {
      if (email !== adminEmail()) {
        installLimiter.fail(LIMIT_KEY);
        return {
          ok: false,
          message:
            "Cette adresse n'est pas celle déclarée pour l'installation (réglage ADMIN_EMAIL du serveur).",
        };
      }
    } else if (!safeEqual((data.setupCode ?? "").trim(), setupCode()!)) {
      installLimiter.fail(LIMIT_KEY);
      return { ok: false, message: "Code d'installation incorrect." };
    }
    installLimiter.reset(LIMIT_KEY);

    const taken = await withAccountStore(async (store) => {
      if (await store.emailTaken(email)) return "Un compte existe déjà avec cet email.";
      if (await store.phoneTaken(phone)) return "Ce numéro est déjà associé à un compte.";
      return null;
    });
    if (taken) return { ok: false, message: taken };

    const now = Date.now();
    // Avec l'envoi d'emails, l'adresse est toujours vérifiée par un code ;
    // sans, le code d'installation accepté suffit.
    const verify = emailConfigured();
    const pending: PendingInstall = {
      firstName: data.firstName,
      lastName: data.lastName,
      email,
      phone,
      id: crypto.randomUUID(),
      code: verify ? generateSixDigitCode() : "",
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
      verifiedAt: verify ? undefined : now,
    };
    const session = await authSession();
    await session.update({ pendingInstall: pending });
    if (!verify) return { ok: true, next: "password", resendInSeconds: 0 };
    const sent = await sendInstallCode(pending);
    if (!sent.ok) {
      await session.update({ pendingInstall: undefined });
      return sent;
    }
    return { ok: true, next: "verify", resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  });

export type InstallResendResult =
  | { ok: true; resendInSeconds: number }
  | { ok: false; message: string; waitSeconds?: number; restart?: boolean };

export const installResendFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<InstallResendResult> => {
    const session = await authSession();
    const pending = session.data.pendingInstall;
    if (!pending?.code || pending.verifiedAt) return { ok: false, restart: true, message: RESTART };
    const wait = Math.ceil((pending.sentAt + RESEND_COOLDOWN_MS - Date.now()) / 1000);
    if (wait > 0) return { ok: false, waitSeconds: wait, message: `Patientez ${wait} s.` };
    const now = Date.now();
    const next: PendingInstall = {
      ...pending,
      id: crypto.randomUUID(),
      code: generateSixDigitCode(),
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
    };
    await session.update({ pendingInstall: next });
    const sent = await sendInstallCode(next);
    if (!sent.ok) return sent;
    return { ok: true, resendInSeconds: RESEND_COOLDOWN_MS / 1000 };
  },
);

// --- Étape « vérification » --------------------------------------------------------

export type InstallVerifyResult = { ok: true } | { ok: false; message: string; restart?: boolean };

export const installVerifyFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => ({ code: String(input?.code ?? "").slice(0, 12) }))
  .handler(async ({ data }): Promise<InstallVerifyResult> => {
    const session = await authSession();
    const pending = session.data.pendingInstall;
    if (!pending?.code) return { ok: false, restart: true, message: RESTART };
    if (pending.verifiedAt) return { ok: true };
    if (Date.now() > pending.expiresAt) {
      return { ok: false, message: "Code expiré. Demandez un nouveau code." };
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS || codeLimiter.lockedMinutes(pending.id) > 0) {
      return { ok: false, message: "Trop d'essais. Demandez un nouveau code." };
    }
    if (!safeEqual(data.code.replace(/\s/g, ""), pending.code)) {
      codeLimiter.fail(pending.id);
      const attempts = pending.attempts + 1;
      await session.update({ pendingInstall: { ...pending, attempts } });
      const left = Math.min(MAX_CODE_ATTEMPTS - attempts, codeLimiter.remaining(pending.id));
      return {
        ok: false,
        message:
          left > 0
            ? `Code incorrect. ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.`
            : "Trop d'essais. Demandez un nouveau code.",
      };
    }
    codeLimiter.reset(pending.id);
    await session.update({ pendingInstall: { ...pending, verifiedAt: Date.now() } });
    return { ok: true };
  });

// --- Étape « mot de passe » : création du compte -----------------------------------

const passwordSchema = z
  .object({
    // Compte le plus puissant de la plateforme : 12 caractères minimum.
    password: z.string().min(12, "12 caractères minimum").max(128, "128 caractères maximum"),
    confirm: z.string(),
    twoFa: z.boolean(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe diffèrent",
    path: ["confirm"],
  });

export type InstallResult =
  { ok: true; user: CurrentUser } | { ok: false; message: string; restart?: boolean };

export const installFinishFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof passwordSchema>) => {
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<InstallResult> => {
    const session = await authSession();
    const pending = session.data.pendingInstall;
    if (!pending?.verifiedAt || Date.now() - pending.verifiedAt > VERIFIED_TTL_MS) {
      await session.update({ pendingInstall: undefined });
      return { ok: false, restart: true, message: RESTART };
    }
    const state = await currentState();
    if (state === "installed") {
      await session.update({ pendingInstall: undefined });
      return { ok: false, message: ALREADY_INSTALLED };
    }
    if (state !== "ready") return { ok: false, message: NOT_CONFIGURED };
    // Double authentification : ses codes partent par email.
    const twoFa = data.twoFa && emailConfigured();

    return withAccountStore(async (store) => {
      const result = await store.createFirstSuperAdmin({
        email: pending.email,
        phone: pending.phone,
        passwordHash: await hash(data.password, BCRYPT_COST),
        firstName: pending.firstName,
        lastName: pending.lastName,
        emailVerified: !!pending.code,
        twoFaEnabled: twoFa,
      });
      if (!result.ok) {
        await session.update({ pendingInstall: undefined });
        return {
          ok: false as const,
          restart: result.reason !== "already_installed",
          message:
            result.reason === "already_installed"
              ? ALREADY_INSTALLED
              : result.reason === "phone_taken"
                ? "Ce numéro est déjà associé à un compte."
                : "Un compte existe déjà avec cet email.",
        };
      }
      // Session ouverte tout de suite : la suite se passe dans l'assistant
      // de configuration.
      await session.update({
        email: result.account.email,
        role: result.account.role,
        pv: await passwordVersion(result.account.passwordHash),
        pendingTwoFa: undefined,
        pendingRegistration: undefined,
        pendingInstall: undefined,
      });
      await store.recordLogin(result.account.id);
      return { ok: true as const, user: toCurrentUser(result.account) };
    });
  });

/** Recommencer depuis l'identité (autre adresse, autre téléphone…). */
export const installRestartFn = createServerFn({ method: "POST" }).handler(async () => {
  await (await authSession()).update({ pendingInstall: undefined });
  return { ok: true as const };
});
