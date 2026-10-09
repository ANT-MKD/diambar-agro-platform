import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AttemptLimiter, normalizeSenegalPhone } from "@/lib/auth/helpers";
import { requireAdminSession } from "@/lib/auth/guards.server";
import { createInviteToken, INVITE_TTL_MS, readInvite } from "./invites.server";
import {
  addRequest,
  getRequest,
  listRequests,
  openRequestForPhone,
  updateRequest,
  type AccessRequest,
  type AccessStatus,
} from "./requests.server";

export type { AccessRequest, AccessStatus };

// Au plus 3 demandes par numéro et par jour : freine les envois en rafale.
const requestLimiter = new AttemptLimiter(3, 24 * 60 * 60_000);

const accessRequestSchema = z.object({
  role: z.enum(["restaurant", "farmer", "driver"]),
  fullName: z.string().trim().min(3, "Indiquez votre nom complet").max(80),
  phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
    message: "Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67)",
  }),
  organization: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "Choisissez votre ville"),
  area: z.string().trim().max(80).optional(),
  message: z.string().trim().max(500).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Acceptez d'être recontacté pour envoyer la demande" }),
  }),
});

export type AccessRequestInput = z.input<typeof accessRequestSchema>;

export const submitAccessRequestFn = createServerFn({ method: "POST" })
  .validator((input: AccessRequestInput) => {
    const parsed = accessRequestSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  })
  .handler(async ({ data }): Promise<{ ok: true; alreadyPending: boolean }> => {
    const key = normalizeSenegalPhone(data.phone)!;
    // Une demande déjà en cours pour ce numéro : on ne la duplique pas.
    if (openRequestForPhone(key)) return { ok: true, alreadyPending: true };
    if (requestLimiter.lockedMinutes(key) > 0) return { ok: true, alreadyPending: true };
    requestLimiter.fail(key);
    if (data.role !== "driver" && !data.organization) {
      throw new Error(
        data.role === "restaurant"
          ? "Indiquez le nom de votre établissement"
          : "Indiquez le nom de votre exploitation",
      );
    }
    addRequest({
      role: data.role,
      fullName: data.fullName,
      phone: key,
      organization: data.organization || undefined,
      city: data.city,
      area: data.area || undefined,
      message: data.message || undefined,
    });
    return { ok: true, alreadyPending: false };
  });

export const listAccessRequestsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccessRequest[]> => {
    await requireAdminSession();
    return listRequests();
  },
);

const STATUS_LABEL: Record<AccessStatus, string> = {
  new: "Nouvelle",
  contacted: "Contacté",
  invited: "Invitation envoyée",
  registered: "Inscrit",
  declined: "Refusée",
};

export const setAccessRequestStatusFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; status: "contacted" | "declined" | "new" }) => input)
  .handler(async ({ data }): Promise<AccessRequest> => {
    const admin = await requireAdminSession();
    const r = updateRequest(
      data.id,
      { status: data.status },
      admin.name,
      `Statut : ${STATUS_LABEL[data.status]}`,
    );
    if (!r) throw new Error("Demande introuvable.");
    return r;
  });

export const createInviteFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(
    async ({ data }): Promise<{ path: string; expiresAt: string; request: AccessRequest }> => {
      const admin = await requireAdminSession();
      const r = getRequest(data.id);
      if (!r) throw new Error("Demande introuvable.");
      if (r.status === "registered") throw new Error("Cette personne est déjà inscrite.");
      const token = await createInviteToken({
        requestId: r.id,
        role: r.role,
        fullName: r.fullName,
        phone: r.phone,
      });
      const now = new Date();
      const updated = updateRequest(
        r.id,
        { status: "invited", invitedAt: now.toISOString() },
        admin.name,
        "Invitation à s'inscrire générée (valable 7 jours)",
      )!;
      return {
        path: `/register?invite=${encodeURIComponent(token)}`,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        request: updated,
      };
    },
  );

export type InviteCheck =
  | { valid: true; role: "restaurant" | "farmer" | "driver"; fullName: string; phone: string }
  | { valid: false; reason: "missing" | "expired" | "used" };

export const validateInviteFn = createServerFn({ method: "GET" })
  .validator((input: { token?: string }) => input)
  .handler(async ({ data }): Promise<InviteCheck> => {
    const state = await readInvite(data.token);
    if (!state.valid) return { valid: false, reason: state.reason };
    const { role, fullName, phone } = state.payload;
    return { valid: true, role, fullName, phone };
  });
