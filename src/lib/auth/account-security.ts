import { createServerFn } from "@tanstack/react-start";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { appUrl, codeDeliveryAvailable, notify } from "@/lib/notify/notify.server";
import { passwordChangedEmail } from "@/lib/notify/templates";
import { passwordVersion } from "./accounts.server";
import {
  checkTwoFaSetupCode,
  sendTwoFaSetupCode,
  type SecurityResult,
  type SendCodeResult,
} from "./two-fa-setup.server";
import { requireAccount } from "./guard.server";
import { authSession } from "./session.server";
import { withAccountStore, type SecurityEvent } from "./store.server";

// Sécurité du compte connecté, pour tous les rôles : mot de passe, double
// authentification par email (code à chaque connexion) et journal des
// connexions. Tout est vérifié ici, côté serveur.

const BCRYPT_COST = 12;

export type MySecurity = {
  email: string;
  twoFaEnabled: boolean;
  /** L'envoi des codes par email est configuré (sinon pas d'activation). */
  codeDelivery: boolean;
  passwordChangedAt: string | null;
  events: SecurityEvent[];
};

export const mySecurityFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MySecurity> =>
    withAccountStore(async (store) => {
      const account = await requireAccount(store);
      return {
        email: account.email,
        twoFaEnabled: account.twoFaEnabled,
        codeDelivery: codeDeliveryAvailable(),
        passwordChangedAt: account.passwordChangedAt?.toISOString() ?? null,
        events: await store.securityEvents(account.id, 12),
      };
    }),
);

const passwordSchema = z.object({
  current: z.string().min(1, "Saisissez votre mot de passe actuel").max(128),
  next: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
});

/** Nouveau mot de passe : l'actuel est exigé. Les autres appareils sont
 * déconnectés (leur session porte l'ancienne version du mot de passe) ;
 * celui-ci reste connecté. */
export const changePasswordFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof passwordSchema>) => {
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Données invalides");
    return parsed.data;
  })
  .handler(async ({ data }): Promise<SecurityResult> =>
    withAccountStore(async (store) => {
      const account = await requireAccount(store);
      if (!(await compare(data.current, account.passwordHash))) {
        await store.audit({
          actorId: account.id,
          module: "security",
          action: "Changement de mot de passe refusé (mot de passe actuel faux)",
          targetType: "user",
          targetId: account.id,
          status: "failed",
        });
        return { ok: false, message: "Mot de passe actuel incorrect." };
      }
      if (data.next === data.current) {
        return { ok: false, message: "Choisissez un mot de passe différent de l'actuel." };
      }
      const newHash = await hash(data.next, BCRYPT_COST);
      await store.setPasswordHash(account.id, newHash);
      const session = await authSession();
      await session.update({ pv: await passwordVersion(newHash) });
      await store.audit({
        actorId: account.id,
        module: "security",
        action: "Mot de passe modifié",
        targetType: "user",
        targetId: account.id,
      });
      await notify(
        account.email,
        passwordChangedEmail({
          name: `${account.firstName} ${account.lastName}`.trim(),
          supportUrl: appUrl("/contact"),
        }),
      );
      return { ok: true };
    }),
  );

export const sendMyTwoFaCodeFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<SendCodeResult> =>
    withAccountStore(async (store) => sendTwoFaSetupCode(await requireAccount(store))),
);

/** Activer : avec le code reçu. Désactiver : avec le mot de passe. */
export const setMyTwoFaFn = createServerFn({ method: "POST" })
  .validator((input: { enabled: boolean; code?: string; password?: string }) => ({
    enabled: input.enabled === true,
    code: String(input.code ?? "").slice(0, 12),
    password: String(input.password ?? "").slice(0, 128),
  }))
  .handler(async ({ data }): Promise<SecurityResult> =>
    withAccountStore(async (store) => {
      const account = await requireAccount(store);
      if (data.enabled === account.twoFaEnabled) return { ok: true };
      if (data.enabled) {
        const check = await checkTwoFaSetupCode(account.id, data.code);
        if (!check.ok) return check;
      } else if (!data.password || !(await compare(data.password, account.passwordHash))) {
        return { ok: false, message: "Mot de passe incorrect." };
      }
      // setTwoFa inscrit lui-même l'activation ou la désactivation au journal.
      await store.setTwoFa(account.id, data.enabled);
      return { ok: true };
    }),
  );

export type { SecurityResult, SendCodeResult };
