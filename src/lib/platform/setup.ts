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
  checkTwoFaSetupCode,
  sendTwoFaSetupCode,
  type SendCodeResult,
} from "@/lib/auth/two-fa-setup.server";
import {
  generateSixDigitCode,
  normalizeEmail,
  normalizeSenegalPhone,
  safeEqual,
} from "@/lib/auth/helpers";
import { authSession } from "@/lib/auth/session.server";
import { withAccountStore, type AccountStore } from "@/lib/auth/store.server";
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
import { DEFAULT_RULES, minutesOf, normalizeDeliveryHours } from "@/lib/platform-rules";
import { readLoginSecurity, readMaintenance, type LoginSecurity, type Maintenance } from "./params";

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
  "payment_deadline_hour",
  "delivery_hours",
  "min_payout",
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
      const me = await requireStaff(store, "super_admin");
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
          paymentDeadlineHour: num(
            s.payment_deadline_hour,
            DEFAULT_SETTINGS.payment_deadline_hour as number,
          ),
          deliveryFrom: normalizeDeliveryHours(s.delivery_hours).from,
          deliveryTo: normalizeDeliveryHours(s.delivery_hours).to,
          minPayout: num(s.min_payout, DEFAULT_RULES.minPayout),
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
        roles: await store.listAdminRoles(),
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
  whatsapp: z
    .string()
    .default("")
    .refine((p) => !p.trim() || normalizeSenegalPhone(p) !== null, {
      message: "WhatsApp : 9 chiffres attendus, ou laissez vide",
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
  paymentDeadlineHour: z.number().int().min(0).max(23),
  deliveryFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure de début invalide"),
  deliveryTo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure de fin invalide"),
  minPayout: z.number().int().min(0).max(10_000_000),
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
    cashOnDelivery: z.object({
      enabled: z.boolean(),
      driverLimit: z.number().int().min(0).max(5_000_000).optional(),
    }),
    approvalThreshold: z.number().int().min(0).max(100_000_000).optional(),
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
      const me = await requireStaff(store, "super_admin");
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
          const company: CompanyInfo = {
            ...c,
            phone: normalizeSenegalPhone(c.phone)!,
            whatsapp: c.whatsapp.trim() ? normalizeSenegalPhone(c.whatsapp)! : "",
          };
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
          if (minutesOf(o.deliveryTo) - minutesOf(o.deliveryFrom) < 60) {
            throw new Error("Les heures de livraison doivent couvrir au moins une heure.");
          }
          await store.setSettings(
            {
              cutoff_hour: o.cutoffHour,
              min_order_per_producer: o.minOrderPerProducer,
              reception_window_hours: o.receptionWindowHours,
              payment_deadline_hour: o.paymentDeadlineHour,
              delivery_hours: { from: o.deliveryFrom, to: o.deliveryTo },
              min_payout: o.minPayout,
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
                cashOnDelivery: {
                  enabled: p.cashOnDelivery.enabled,
                  driverLimit: p.cashOnDelivery.driverLimit ?? 50_000,
                },
                approvalThreshold: p.approvalThreshold ?? 100_000,
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

export const sendTwoFaSetupCodeFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<SendCodeResult> =>
    withAccountStore(async (store) => sendTwoFaSetupCode(await requireStaff(store, "super_admin"))),
);

// --- Équipe : invitation par lien signé ----------------------------------------

export type StaffInvite = {
  kind: "staff_invite";
  email: string;
  firstName: string;
  lastName: string;
  /** Ancienne colonne : rôle fourni du même nom, sinon « support ». */
  staffRole: "operations" | "finance" | "support";
  /** Rôle choisi (absent des invitations d'avant les rôles personnalisés). */
  roleId?: string;
  roleName?: string;
};

const INVITE_TTL_MS = 72 * 3_600_000;

const inviteSchema = z.object({
  firstName: text(2, 60, "Prénom requis"),
  lastName: text(2, 60, "Nom requis"),
  email: z.string().trim().email("Email invalide").max(200),
  roleId: z.string().min(1, "Choisissez un rôle").max(64),
});

export const createStaffInviteFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof inviteSchema>) => parse(inviteSchema, input))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; path: string; emailed: boolean } | { ok: false; message: string }> =>
      withAccountStore(async (store) => {
        const me = await requireStaff(store, "security.manage_admins");
        const email = normalizeEmail(data.email);
        if (await store.emailTaken(email)) {
          return { ok: false, message: "Un compte existe déjà avec cet email." };
        }
        const role = (await store.listAdminRoles()).find((r) => r.id === data.roleId);
        if (!role) return { ok: false, message: "Rôle introuvable." };
        // Hors super admin : pas d'invitation avec plus de droits que les siens.
        if (
          me.staffRole !== "super_admin" &&
          role.permissions.some((p) => !me.permissions.includes(p))
        ) {
          return {
            ok: false,
            message: "Vous ne pouvez pas inviter avec un rôle qui a plus de droits que le vôtre.",
          };
        }
        const systemKey = role.systemKey as StaffInvite["staffRole"] | null;
        const token = await createSignedToken<StaffInvite>(
          {
            kind: "staff_invite",
            firstName: data.firstName,
            lastName: data.lastName,
            email,
            staffRole:
              systemKey === "operations" || systemKey === "finance" ? systemKey : "support",
            roleId: role.id,
            roleName: role.name,
          },
          INVITE_TTL_MS,
        );
        await store.audit({
          actorId: me.id,
          module: "security",
          action: "Invitation d'un membre de l'équipe",
          targetType: "email",
          targetId: email,
          after: { role: role.name },
        });
        const path = `/invitation?token=${token}`;
        const emailed = await notify(
          email,
          staffInviteEmail({
            firstName: data.firstName,
            roleLabel: role.name,
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
      const me = await requireStaff(store, "super_admin");
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

// --- Paramètres courants (page Paramètres de l'administration) -----------------

export type PlatformParams = {
  commissionTiers: CommissionTierSetting[];
  /** Montant à partir duquel un retrait ou un remboursement demande deux
   * administrateurs ; null tant que les paiements ne sont pas configurés. */
  approvalThreshold: number | null;
  loginSecurity: LoginSecurity;
  maintenance: Maintenance;
};

async function readParams(store: AccountStore): Promise<PlatformParams> {
  const s = await store.getSettings([
    "commission_tiers",
    "payment_methods",
    "login_security",
    "maintenance",
  ]);
  const pm = s.payment_methods as PaymentMethodsSetting | undefined;
  return {
    commissionTiers:
      (s.commission_tiers as CommissionTierSetting[] | undefined) ??
      (DEFAULT_SETTINGS.commission_tiers as CommissionTierSetting[]),
    approvalThreshold: pm ? (pm.approvalThreshold ?? 100_000) : null,
    loginSecurity: readLoginSecurity(s.login_security),
    maintenance: readMaintenance(s.maintenance),
  };
}

export const getPlatformParamsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformParams> =>
    withAccountStore(async (store) => {
      await requireStaff(store);
      return readParams(store);
    }),
);

const paramsSchema = z.object({
  commissionTiers: moneySchema.shape.tiers.optional(),
  approvalThreshold: z.number().int().min(0).max(100_000_000).optional(),
  loginSecurity: z
    .object({
      maxAttempts: z.number().int().min(1, "Au moins 1 tentative").max(20, "20 tentatives au plus"),
      lockoutMinutes: z.number().int().min(1, "Au moins 1 minute").max(1440, "24 heures au plus"),
    })
    .optional(),
  maintenance: z
    .object({ active: z.boolean(), message: text(1, 500, "Message de maintenance requis") })
    .optional(),
});

/** Enregistre les paramètres modifiés (permission « Modifier les paramètres »). */
export const savePlatformParamsFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof paramsSchema>) => parse(paramsSchema, input))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; params: PlatformParams } | { ok: false; message: string }> =>
      withAccountStore(async (store) => {
        const me = await requireStaff(store, "settings.edit");
        const values: Record<string, unknown> = {};
        if (data.commissionTiers) values.commission_tiers = data.commissionTiers;
        if (data.loginSecurity) values.login_security = data.loginSecurity;
        if (data.maintenance) values.maintenance = data.maintenance;
        if (data.approvalThreshold !== undefined) {
          const { payment_methods } = await store.getSettings(["payment_methods"]);
          if (!payment_methods) {
            return {
              ok: false,
              message: "Configurez d'abord les moyens de paiement (assistant de configuration).",
            };
          }
          values.payment_methods = {
            ...(payment_methods as PaymentMethodsSetting),
            approvalThreshold: data.approvalThreshold,
          };
        }
        await store.setSettings(values, me.id);
        return { ok: true, params: await readParams(store) };
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
