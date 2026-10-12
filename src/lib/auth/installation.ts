import { createServerFn } from "@tanstack/react-start";
import { hash } from "bcryptjs";
import { z } from "zod";
import { BCRYPT_COST, passwordVersion, toCurrentUser, type CurrentUser } from "./accounts.server";
import { setupCode } from "./config.server";
import { AttemptLimiter, normalizeEmail, normalizeSenegalPhone, safeEqual } from "./helpers";
import { authSession } from "./session.server";
import { withAccountStore } from "./store.server";

// Installation : création du premier super administrateur, protégée par un
// code secret (SETUP_CODE) connu de la seule personne qui déploie. La page se
// ferme pour toujours dès qu'un super administrateur existe.

export type InstallationState =
  | "ready" // base branchée, code configuré, aucun super admin
  | "installed" // un super admin existe : rien à faire ici
  | "not_configured" // SETUP_CODE absent ou trop court
  | "no_database"; // mode démo sans base : comptes de démo

const installLimiter = new AttemptLimiter(5, 15 * 60_000);
const LIMIT_KEY = "installation";

async function currentState(): Promise<InstallationState> {
  return withAccountStore(async (store) => {
    if (store.kind === "memory") return "no_database";
    if (await store.superAdminExists()) return "installed";
    return setupCode() ? "ready" : "not_configured";
  });
}

export const getInstallationStateFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ state: InstallationState }> => ({ state: await currentState() }),
);

const installSchema = z
  .object({
    setupCode: z.string().min(1, "Code d'installation requis").max(200),
    firstName: z.string().trim().min(2, "Prénom requis").max(60),
    lastName: z.string().trim().min(2, "Nom requis").max(60),
    email: z.string().trim().email("Email invalide").max(200),
    phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
      message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
    }),
    // Compte le plus puissant de la plateforme : 12 caractères minimum.
    password: z.string().min(12, "12 caractères minimum").max(128, "128 caractères maximum"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe diffèrent",
    path: ["confirm"],
  });

export type InstallResult = { ok: true; user: CurrentUser } | { ok: false; message: string };

export const installFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof installSchema>) => {
    const parsed = installSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<InstallResult> => {
    const minutes = installLimiter.lockedMinutes(LIMIT_KEY);
    if (minutes > 0) {
      return { ok: false, message: `Trop d'essais. Réessayez dans ${minutes} minute(s).` };
    }
    const state = await currentState();
    if (state === "installed") {
      return { ok: false, message: "L'installation est déjà faite. Connectez-vous." };
    }
    const expected = setupCode();
    if (state !== "ready" || !expected) {
      return { ok: false, message: "L'installation n'est pas configurée sur ce serveur." };
    }
    if (!safeEqual(data.setupCode.trim(), expected)) {
      installLimiter.fail(LIMIT_KEY);
      return { ok: false, message: "Code d'installation incorrect." };
    }
    installLimiter.reset(LIMIT_KEY);

    return withAccountStore(async (store) => {
      const result = await store.createFirstSuperAdmin({
        email: normalizeEmail(data.email),
        phone: normalizeSenegalPhone(data.phone)!,
        passwordHash: await hash(data.password, BCRYPT_COST),
        firstName: data.firstName,
        lastName: data.lastName,
      });
      if (!result.ok) {
        return {
          ok: false as const,
          message:
            result.reason === "already_installed"
              ? "L'installation est déjà faite. Connectez-vous."
              : result.reason === "phone_taken"
                ? "Ce numéro est déjà associé à un compte."
                : "Un compte existe déjà avec cet email.",
        };
      }
      // Session ouverte tout de suite : la suite se passe dans l'assistant
      // de configuration.
      const session = await authSession();
      await session.update({
        email: result.account.email,
        role: result.account.role,
        pv: await passwordVersion(result.account.passwordHash),
        pendingTwoFa: undefined,
        pendingRegistration: undefined,
      });
      await store.recordLogin(result.account.id);
      return { ok: true as const, user: toCurrentUser(result.account) };
    });
  });
