import { createServerFn } from "@tanstack/react-start";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createDb } from "@/db/client.server";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import { MarketError } from "@/lib/market/market-common.server";
import { acceptInvite, readInvite, type InviteInfo } from "@/lib/market/team-db.server";
import { BCRYPT_COST, passwordVersion, toCurrentUser, type CurrentUser } from "./accounts.server";
import { normalizeSenegalPhone } from "./helpers";
import { authSession } from "./session.server";
import { verifySignedToken } from "./tokens.server";

// Invitation à rejoindre l'équipe d'un restaurant ou d'un producteur : lien
// signé (7 jours) envoyé par le titulaire. La personne crée son propre compte
// et arrive directement dans l'espace de l'établissement.

async function memberIdOf(token: string): Promise<string | null> {
  const payload = await verifySignedToken<{ kind: string; memberId: string }>(token);
  return payload?.kind === "team_invite" ? payload.memberId : null;
}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Base de données non configurée.");
  return createDb(url);
}

export const getTeamInvitationFn = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => ({ token: String(input.token ?? "") }))
  .handler(async ({ data }): Promise<InviteInfo> => {
    const memberId = await memberIdOf(data.token);
    if (!memberId) return { valid: false, reason: "expired" };
    const { db, close } = database();
    try {
      return await readInvite(db, memberId);
    } finally {
      await close().catch(() => undefined);
    }
  });

const acceptSchema = z
  .object({
    token: z.string().min(1),
    firstName: z.string().trim().min(2, "Prénom requis").max(60),
    lastName: z.string().trim().min(2, "Nom requis").max(60),
    phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
      message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
    }),
    password: z.string().min(12, "12 caractères minimum").max(128, "128 caractères maximum"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe diffèrent",
    path: ["confirm"],
  });

export const acceptTeamInvitationFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof acceptSchema>) => {
    const parsed = acceptSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(
    async ({ data }): Promise<{ ok: true; user: CurrentUser } | { ok: false; message: string }> => {
      const memberId = await memberIdOf(data.token);
      if (!memberId) {
        return { ok: false, message: "Cette invitation a expiré. Demandez-en une nouvelle." };
      }
      const { db, close } = database();
      try {
        const created = await acceptInvite(db, memberId, {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: normalizeSenegalPhone(data.phone)!,
          passwordHash: await hash(data.password, BCRYPT_COST),
        });
        const store = new DbAccountStore(db);
        const account = await store.findById(created.id);
        if (!account) return { ok: false, message: "Compte introuvable. Connectez-vous." };
        const session = await authSession();
        await session.update({
          email: account.email,
          role: account.role,
          pv: await passwordVersion(account.passwordHash),
          pendingTwoFa: undefined,
          pendingRegistration: undefined,
        });
        await store.recordLogin(account.id);
        return { ok: true, user: toCurrentUser(account) };
      } catch (err) {
        if (err instanceof MarketError) return { ok: false, message: err.message };
        throw err;
      } finally {
        await close().catch(() => undefined);
      }
    },
  );
