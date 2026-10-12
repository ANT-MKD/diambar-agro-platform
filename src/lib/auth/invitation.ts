import { createServerFn } from "@tanstack/react-start";
import { hash } from "bcryptjs";
import { z } from "zod";
import type { StaffInvite } from "@/lib/platform/setup";
import { BCRYPT_COST, passwordVersion, toCurrentUser, type CurrentUser } from "./accounts.server";
import { normalizeSenegalPhone } from "./helpers";
import { authSession } from "./session.server";
import { STAFF_ROLE_LABEL, withAccountStore } from "./store.server";
import { verifySignedToken } from "./tokens.server";

// Invitation d'un membre de l'équipe : lien signé (72 h) créé par le super
// administrateur. Le lien ne sert qu'une fois : dès que le compte existe, il
// est refusé.

export type InvitationInfo =
  | { valid: true; firstName: string; lastName: string; email: string; roleLabel: string }
  | { valid: false; reason: "expired" | "used" };

async function readInvite(token: string): Promise<StaffInvite | null> {
  const payload = await verifySignedToken<StaffInvite>(token);
  return payload?.kind === "staff_invite" ? payload : null;
}

export const getInvitationFn = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => ({ token: String(input.token ?? "") }))
  .handler(async ({ data }): Promise<InvitationInfo> => {
    const invite = await readInvite(data.token);
    if (!invite) return { valid: false, reason: "expired" };
    const used = await withAccountStore((store) => store.emailTaken(invite.email));
    if (used) return { valid: false, reason: "used" };
    return {
      valid: true,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      roleLabel: STAFF_ROLE_LABEL[invite.staffRole],
    };
  });

const acceptSchema = z
  .object({
    token: z.string().min(1),
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

export const acceptInvitationFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof acceptSchema>) => {
    const parsed = acceptSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(
    async ({ data }): Promise<{ ok: true; user: CurrentUser } | { ok: false; message: string }> => {
      const invite = await readInvite(data.token);
      if (!invite)
        return { ok: false, message: "Cette invitation a expiré. Demandez-en une nouvelle." };
      return withAccountStore(async (store) => {
        const result = await store.createStaffMember({
          email: invite.email,
          phone: normalizeSenegalPhone(data.phone)!,
          passwordHash: await hash(data.password, BCRYPT_COST),
          firstName: invite.firstName,
          lastName: invite.lastName,
          staffRole: invite.staffRole,
        });
        if (!result.ok) {
          return {
            ok: false as const,
            message:
              result.reason === "phone_taken"
                ? "Ce numéro est déjà associé à un compte."
                : "Cette invitation a déjà été utilisée. Connectez-vous.",
          };
        }
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
    },
  );
