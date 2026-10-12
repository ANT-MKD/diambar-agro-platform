import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_SETTINGS } from "@/db/seed";
import { isDemoMode } from "@/lib/auth/config.server";
import {
  appUrl,
  codeDeliveryAvailable,
  deliverCode,
  emailStatus,
  notify,
  publicCodeDeliveryAvailable,
} from "@/lib/notify/notify.server";
import { staffInviteEmail, twoFaSetupEmail } from "@/lib/notify/templates";
import { requireStaff } from "@/lib/auth/guard.server";
import {
  generateSixDigitCode,
  normalizeEmail,
  normalizeSenegalPhone,
  safeEqual,
} from "@/lib/auth/helpers";
import { authSession } from "@/lib/auth/session.server";
import { STAFF_ROLE_LABEL, withAccountStore, type AccountStore } from "@/lib/auth/store.server";
import { createSignedToken } from "@/lib/auth/tokens.server";
import {
  SETUP_STEPS,
  setupProgress,
  type CommissionTierSetting,
  type CompanyInfo,
  type PaymentMethodsSetting,
  type PlatformSetup,
  type SetupSnapshot,
  type SetupStepKey,
  type TvaSetting,
} from "./setup-model";

// Assistant de configuration : réservé au super administrateur, contrôlé ici
// côté serveur. Chaque étape enregistre ses réglages dans la base (table
// settings, villes/quartiers, catégories) puis se marque comme faite.

const SETTING_KEYS = [
  "platform_setup",
  "registrations_open",
  "company",
  "cutoff_hour",
  "min_order_per_producer",
  "reception_window_hours",
  "commission_tiers",
  "tva",
  "payment_methods",
];

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function readSetup(store: AccountStore): Promise<PlatformSetup> {
  const { platform_setup } = await store.getSettings(["platform_setup"]);
  return (platform_setup as PlatformSetup | undefined) ?? { steps: {} };
}

export const getSetupFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SetupSnapshot> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store, ["super_admin"]);
      const s = await store.getSettings(SETTING_KEYS);
      return {
        demoMode: isDemoMode(),
        codeDeliveryAvailable: codeDeliveryAvailable(),
        emailStatus: emailStatus(),
        registrationsCanOpen: publicCodeDeliveryAvailable(),
        setup: (s.platform_setup as PlatformSetup | undefined) ?? { steps: {} },
        registrationsOpen: s.registrations_open === true,
        me: { email: me.email, twoFaEnabled: me.twoFaEnabled },
        company: (s.company as CompanyInfo | undefined) ?? null,
        orders: {
          cutoffHour: num(s.cutoff_hour, DEFAULT_SETTINGS.cutoff_hour as number),
          minOrderPerProducer: num(
            s.min_order_per_producer,
            DEFAULT_SETTINGS.min_order_per_producer as number,
          ),
          receptionWindowHours: num(
            s.reception_window_hours,
            DEFAULT_SETTINGS.reception_window_hours as number,
          ),
        },
        money: {
          tiers:
            (s.commission_tiers as CommissionTierSetting[] | undefined) ??
            (DEFAULT_SETTINGS.commission_tiers as CommissionTierSetting[]),
          tva: (s.tva as TvaSetting | undefined) ?? (DEFAULT_SETTINGS.tva as TvaSetting),
        },
        payments: (s.payment_methods as PaymentMethodsSetting | undefined) ?? null,
        zone: await store.getPilotZone(),
        categories: await store.listCategories(),
        team: await store.listStaff(),
      };
    }),
);

// --- Validation de chaque étape -----------------------------------------------

const text = (min: number, max: number, message: string) =>
  z.string().trim().min(min, message).max(max);

const companySchema = z.object({
  legalName: text(2, 120, "Nom légal requis"),
  tradeName: z.string().trim().max(120).default(""),
  ninea: z.string().trim().max(40).default(""),
  rccm: z.string().trim().max(60).default(""),
  address: text(5, 200, "Adresse du siège requise"),
  email: z.string().trim().email("Email de contact invalide").max(200),
  phone: z.string().refine((p) => normalizeSenegalPhone(p) !== null, {
    message: "Téléphone de contact : 9 chiffres attendus",
  }),
});

const zoneSchema = z.object({
  city: text(2, 80, "Nom de la ville requis"),
  baseFee: z.number().int().min(0).max(100_000),
  perKmFee: z.number().int().min(0).max(10_000),
  zones: z
    .array(text(2, 80, "Nom de quartier trop court"))
    .min(1, "Ajoutez au moins un quartier livré")
    .max(80),
});

const ordersSchema = z.object({
  cutoffHour: z.number().int().min(0).max(23),
  minOrderPerProducer: z.number().int().min(0).max(10_000_000),
  receptionWindowHours: z.number().int().min(1).max(168),
});

const moneySchema = z.object({
  tiers: z
    .array(
      z.object({
        label: text(1, 40, "Nom de palier requis"),
        rate: z.number().min(0).max(50),
        min: z.number().int().min(0),
        max: z.number().int().positive().nullable(),
      }),
    )
    .min(1)
    .max(8)
    .superRefine((tiers, ctx) => {
      tiers.forEach((t, i) => {
        if (t.max !== null && t.max <= t.min) {
          ctx.addIssue({ code: "custom", message: `Palier « ${t.label} » : maximum ≤ minimum` });
        }
        if (i > 0 && t.min <= tiers[i - 1].min) {
          ctx.addIssue({ code: "custom", message: "Les paliers doivent être croissants" });
        }
      });
    }),
  tva: z.object({ enabled: z.boolean(), rate: z.number().min(0).max(30) }),
});

const paymentsSchema = z
  .object({
    wave: z.object({ enabled: z.boolean(), number: z.string().max(30) }),
    orangeMoney: z.object({ enabled: z.boolean(), number: z.string().max(30) }),
    cashOnDelivery: z.object({ enabled: z.boolean() }),
  })
  .superRefine((p, ctx) => {
    if (!p.wave.enabled && !p.orangeMoney.enabled && !p.cashOnDelivery.enabled) {
      ctx.addIssue({ code: "custom", message: "Activez au moins un moyen de paiement" });
    }
    for (const [label, m] of [
      ["Wave", p.wave],
      ["Orange Money", p.orangeMoney],
    ] as const) {
      if (m.enabled && normalizeSenegalPhone(m.number) === null) {
        ctx.addIssue({ code: "custom", message: `Numéro marchand ${label} : 9 chiffres attendus` });
      }
    }
  });

const catalogSchema = z.object({
  names: z
    .array(text(2, 40, "Nom de catégorie trop court"))
    .min(1, "Gardez au moins une catégorie")
    .max(30),
});

export type SaveStepInput =
  | { step: "security"; data: { twoFaEnabled: boolean; code?: string } }
  | { step: "company"; data: z.input<typeof companySchema> }
  | { step: "zone"; data: z.input<typeof zoneSchema> }
  | { step: "orders"; data: z.input<typeof ordersSchema> }
  | { step: "money"; data: z.input<typeof moneySchema> }
  | { step: "payments"; data: z.input<typeof paymentsSchema> }
  | { step: "catalog"; data: z.input<typeof catalogSchema> }
  | { step: "team"; data: Record<string, never> };

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw new Error(res.error.issues[0].message);
  return res.data;
}

function uniqueTrimmed(names: string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((n) => n.trim())
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export type SaveStepResult = { ok: true; notice?: string } | { ok: false; message: string };

export const saveSetupStepFn = createServerFn({ method: "POST" })
  .validator((input: SaveStepInput) => {
    if (!SETUP_STEPS.some((s) => s.key === input?.step)) throw new Error("Étape inconnue");
    return input;
  })
  .handler(async ({ data: input }): Promise<SaveStepResult> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store, ["super_admin"]);
      let notice: string | undefined;
      switch (input.step) {
        case "security": {
          const wanted = input.data.twoFaEnabled === true;
          if (wanted && !me.twoFaEnabled) {
            // Activation seulement avec le code reçu : preuve que l'email arrive.
            const check = await checkTwoFaSetupCode(me.id, String(input.data.code ?? ""));
            if (!check.ok) return check;
            await store.setTwoFa(me.id, true);
            await store.audit({
              actorId: me.id,
              module: "security",
              action: "Double authentification activée",
              targetType: "user",
              targetId: me.id,
            });
          } else if (!wanted && me.twoFaEnabled) {
            await store.setTwoFa(me.id, false);
            await store.audit({
              actorId: me.id,
              module: "security",
              action: "Double authentification désactivée",
              targetType: "user",
              targetId: me.id,
            });
          }
          break;
        }
        case "company": {
          const c = parse(companySchema, input.data);
          const company: CompanyInfo = { ...c, phone: normalizeSenegalPhone(c.phone)! };
          company.email = normalizeEmail(company.email);
          await store.setSettings({ company }, me.id);
          break;
        }
        case "zone": {
          const z0 = parse(zoneSchema, input.data);
          await store.savePilotZone({ ...z0, zones: uniqueTrimmed(z0.zones) }, me.id);
          break;
        }
        case "orders": {
          const o = parse(ordersSchema, input.data);
          await store.setSettings(
            {
              cutoff_hour: o.cutoffHour,
              min_order_per_producer: o.minOrderPerProducer,
              reception_window_hours: o.receptionWindowHours,
            },
            me.id,
          );
          break;
        }
        case "money": {
          const m = parse(moneySchema, input.data);
          await store.setSettings({ commission_tiers: m.tiers, tva: m.tva }, me.id);
          break;
        }
        case "payments": {
          const p = parse(paymentsSchema, input.data);
          const clean = (n: string) => normalizeSenegalPhone(n) ?? "";
          await store.setSettings(
            {
              payment_methods: {
                wave: { enabled: p.wave.enabled, number: clean(p.wave.number) },
                orangeMoney: {
                  enabled: p.orangeMoney.enabled,
                  number: clean(p.orangeMoney.number),
                },
                cashOnDelivery: { enabled: p.cashOnDelivery.enabled },
              } satisfies PaymentMethodsSetting,
            },
            me.id,
          );
          break;
        }
        case "catalog": {
          const c = parse(catalogSchema, input.data);
          const kept = await store.saveCategories(uniqueTrimmed(c.names), me.id);
          if (kept.length) {
            notice = `Conservées car déjà utilisées par des produits : ${kept.join(", ")}.`;
          }
          break;
        }
        case "team":
          break;
      }
      const setup = await readSetup(store);
      await store.setSettings(
        {
          platform_setup: {
            ...setup,
            steps: { ...setup.steps, [input.step]: new Date().toISOString() },
          } satisfies PlatformSetup,
        },
        me.id,
      );
      return { ok: true, ...(notice ? { notice } : {}) };
    }),
  );

// --- Double authentification : activation confirmée par un code ---------------

const TWO_FA_SETUP_TTL_MS = 10 * 60_000;
const TWO_FA_SETUP_COOLDOWN_MS = 30_000;
const TWO_FA_SETUP_MAX_ATTEMPTS = 5;

export const sendTwoFaSetupCodeFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<
    | { ok: true; sentTo: string; devCode?: string }
    | { ok: false; message: string; waitSeconds?: number }
  > =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store, ["super_admin"]);
      if (!codeDeliveryAvailable()) {
        return {
          ok: false,
          message:
            "La double authentification sera activable quand l'envoi des emails sera configuré (RESEND_API_KEY et EMAIL_FROM).",
        };
      }
      const session = await authSession();
      const previous = session.data.pendingTwoFaSetup;
      const now = Date.now();
      if (previous?.userId === me.id && now < previous.sentAt + TWO_FA_SETUP_COOLDOWN_MS) {
        const wait = Math.ceil((previous.sentAt + TWO_FA_SETUP_COOLDOWN_MS - now) / 1000);
        return {
          ok: false,
          waitSeconds: wait,
          message: `Patientez ${wait} s avant un nouvel envoi.`,
        };
      }
      const code = generateSixDigitCode();
      await session.update({
        pendingTwoFaSetup: {
          userId: me.id,
          code,
          expiresAt: now + TWO_FA_SETUP_TTL_MS,
          sentAt: now,
          attempts: 0,
        },
      });
      const sent = await deliverCode(me.email, twoFaSetupEmail({ name: me.firstName, code }), code);
      if (!sent.ok) {
        await session.update({ pendingTwoFaSetup: undefined });
        return {
          ok: false,
          message:
            emailStatus() === "test_sender"
              ? `L'email n'a pas pu partir vers ${me.email}. Avec l'adresse d'expédition de test de Resend, seuls les emails vers l'adresse de votre compte Resend partent : la double authentification attendra votre domaine.`
              : sent.message,
        };
      }
      return { ok: true, sentTo: me.email, ...(sent.devCode ? { devCode: sent.devCode } : {}) };
    }),
);

async function checkTwoFaSetupCode(
  userId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await authSession();
  const pending = session.data.pendingTwoFaSetup;
  if (!pending || pending.userId !== userId) {
    return { ok: false, message: "Envoyez-vous d'abord un code de vérification." };
  }
  if (Date.now() > pending.expiresAt || pending.attempts >= TWO_FA_SETUP_MAX_ATTEMPTS) {
    await session.update({ pendingTwoFaSetup: undefined });
    return { ok: false, message: "Code expiré ou trop d'essais : envoyez-vous un nouveau code." };
  }
  if (!safeEqual(code.trim(), pending.code)) {
    const attempts = pending.attempts + 1;
    const left = TWO_FA_SETUP_MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      await session.update({ pendingTwoFaSetup: undefined });
      return { ok: false, message: "Trop d'essais : envoyez-vous un nouveau code." };
    }
    await session.update({ pendingTwoFaSetup: { ...pending, attempts } });
    return {
      ok: false,
      message: `Code incorrect. ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.`,
    };
  }
  await session.update({ pendingTwoFaSetup: undefined });
  return { ok: true };
}

// --- Équipe : invitation par lien signé ----------------------------------------

export type StaffInvite = {
  kind: "staff_invite";
  email: string;
  firstName: string;
  lastName: string;
  staffRole: "operations" | "finance" | "support";
};

const INVITE_TTL_MS = 72 * 3_600_000;

const inviteSchema = z.object({
  firstName: text(2, 60, "Prénom requis"),
  lastName: text(2, 60, "Nom requis"),
  email: z.string().trim().email("Email invalide").max(200),
  staffRole: z.enum(["operations", "finance", "support"]),
});

export const createStaffInviteFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof inviteSchema>) => parse(inviteSchema, input))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; path: string; emailed: boolean } | { ok: false; message: string }> =>
      withAccountStore(async (store) => {
        const me = await requireStaff(store, ["super_admin"]);
        const email = normalizeEmail(data.email);
        if (await store.emailTaken(email)) {
          return { ok: false, message: "Un compte existe déjà avec cet email." };
        }
        const token = await createSignedToken<StaffInvite>(
          { kind: "staff_invite", ...data, email },
          INVITE_TTL_MS,
        );
        await store.audit({
          actorId: me.id,
          module: "security",
          action: "Invitation d'un membre de l'équipe",
          targetType: "email",
          targetId: email,
          after: { role: data.staffRole },
        });
        const path = `/invitation?token=${token}`;
        const emailed = await notify(
          email,
          staffInviteEmail({
            firstName: data.firstName,
            roleLabel: STAFF_ROLE_LABEL[data.staffRole],
            inviterName: `${me.firstName} ${me.lastName}`.trim(),
            url: appUrl(path),
          }),
        );
        return { ok: true, path, emailed };
      }),
  );

// --- Ouverture des inscriptions ------------------------------------------------

export const setRegistrationsOpenFn = createServerFn({ method: "POST" })
  .validator((input: { open: boolean }) => ({ open: input.open === true }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; message: string }> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store, ["super_admin"]);
      const setup = await readSetup(store);
      const { done, total } = setupProgress(setup);
      if (data.open && !publicCodeDeliveryAvailable()) {
        return {
          ok: false,
          message:
            emailStatus() === "test_sender"
              ? "L'adresse d'expédition est encore celle de test de Resend (…@resend.dev) : elle n'envoie qu'à l'adresse de votre compte Resend, les autres personnes ne recevraient pas leur code. Vérifiez votre domaine chez Resend et changez EMAIL_FROM avant d'ouvrir."
              : "Configurez d'abord l'envoi des emails (RESEND_API_KEY et EMAIL_FROM) : sans lui, personne ne peut recevoir son code d'inscription.",
        };
      }
      if (data.open && done < total) {
        return {
          ok: false,
          message: `Terminez d'abord la configuration (${done}/${total} étapes faites).`,
        };
      }
      await store.setSettings(
        {
          registrations_open: data.open,
          ...(data.open && !setup.completedAt
            ? { platform_setup: { ...setup, completedAt: new Date().toISOString() } }
            : {}),
        },
        me.id,
      );
      return { ok: true };
    }),
  );

// --- Bandeau de l'administration ---------------------------------------------

export type AdminShell = {
  pendingApplications: number;
  demoMode: boolean;
  /** Progression de la configuration, pour le super administrateur seulement. */
  setup: { done: number; total: number; registrationsOpen: boolean } | null;
};

export const adminShellFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminShell> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store);
      const applications = await store.listApplications();
      let setup: AdminShell["setup"] = null;
      if (me.staffRole === "super_admin") {
        const { registrations_open } = await store.getSettings(["registrations_open"]);
        setup = {
          ...setupProgress(await readSetup(store)),
          registrationsOpen: registrations_open === true,
        };
      }
      return {
        pendingApplications: applications.filter((a) => a.status === "pending").length,
        demoMode: isDemoMode(),
        setup,
      };
    }),
);
