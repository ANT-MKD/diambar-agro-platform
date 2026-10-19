import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { cities, drivers, farmers, restaurants, users } from "@/db/schema";
import { RECEPTION_DAYS } from "@/data/mocks";
import { normalizeEmail, normalizeSenegalPhone } from "@/lib/auth/helpers";
import { audit, fail, MUTABLE_NOTIFICATIONS, notifyOpsStaff, type Q } from "./market-common.server";
import { normalizeWalletNumber } from "./payouts-db.server";
import type {
  AccountPatch,
  FarmPatch,
  PreferencesPatch,
  ReceptionHoursSetting,
  RestaurantPatch,
  UserPreferences,
} from "./types";

export type { AccountPatch, FarmPatch, PreferencesPatch, RestaurantPatch };

// Profils et réglages personnels : ce que chacun modifie dans « Paramètres »,
// enregistré avec son compte. L'adresse email (identifiant de connexion) ne
// change pas ici ; le mot de passe et la double authentification sont dans
// auth/account-security.

type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };

const DEFAULT_PREFERENCES: UserPreferences = {
  mutedNotifications: [],
  newsletter: false,
  payout: { wave: "", orangeMoney: "", primary: "wave" },
};

/** Notifications que chaque rôle peut couper : jamais celles qui demandent
 * d'agir (commande à confirmer pour le producteur, paiements, litiges). */
export const MUTABLE_BY_ROLE: Record<Me["role"], string[]> = {
  restaurant: ["order"],
  farmer: ["stock"],
  driver: ["offer"],
  admin: [],
};

/** Préférences lues depuis la base, complétées et nettoyées. */
export function readPreferences(raw: unknown): UserPreferences {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<UserPreferences>;
  const payout = (p.payout ?? {}) as Partial<UserPreferences["payout"]>;
  return {
    mutedNotifications: Array.isArray(p.mutedNotifications)
      ? p.mutedNotifications.filter((t): t is string =>
          (MUTABLE_NOTIFICATIONS as readonly string[]).includes(String(t)),
        )
      : [],
    newsletter: p.newsletter === true,
    payout: {
      wave: typeof payout.wave === "string" ? payout.wave : "",
      orangeMoney: typeof payout.orangeMoney === "string" ? payout.orangeMoney : "",
      primary: payout.primary === "orange_money" ? "orange_money" : "wave",
    },
  };
}

async function cityId(q: Q, name: string): Promise<string> {
  const [c] = await q
    .select({ id: cities.id })
    .from(cities)
    .where(and(sql`lower(${cities.name}) = lower(${name.trim()})`, eq(cities.active, true)));
  if (!c) fail("Ville non desservie : choisissez-en une dans la liste.");
  return c.id;
}

function text(value: string | undefined, label: string, min: number, max: number) {
  const v = (value ?? "").trim();
  if (v.length < min)
    fail(min <= 1 ? `${label} : champ obligatoire.` : `${label} : ${min} caractères minimum.`);
  if (v.length > max) fail(`${label} : ${max} caractères maximum.`);
  return v;
}

// --- Compte : nom, téléphone, ville ---------------------------------------------------

export async function updateAccount(db: Db, me: Me, patch: AccountPatch) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(users).where(eq(users.id, me.id));
    if (!before) fail("Compte introuvable.");
    const set: Partial<typeof users.$inferInsert> = {};
    if (patch.firstName !== undefined) set.firstName = text(patch.firstName, "Prénom", 2, 60);
    if (patch.lastName !== undefined) set.lastName = text(patch.lastName, "Nom", 2, 60);
    if (patch.phone !== undefined) {
      const phone = normalizeSenegalPhone(patch.phone);
      if (!phone) fail("Numéro sénégalais à 9 chiffres attendu (ex. 77 123 45 67).");
      if (phone !== before.phone) {
        const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.phone, phone));
        if (taken && taken.id !== me.id) fail("Ce numéro est déjà utilisé par un autre compte.");
        set.phone = phone;
      }
    }
    if (patch.city !== undefined) set.cityId = await cityId(tx, patch.city);
    if (Object.keys(set).length === 0) return;
    await tx
      .update(users)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(users.id, me.id));
    await audit(tx, {
      actorId: me.id,
      action: "Profil modifié",
      targetType: "user",
      targetId: me.id,
      before: { firstName: before.firstName, lastName: before.lastName, phone: before.phone },
      after: set,
    });
  });
}

/** Nouvelle photo (chemin dans le stockage public) ; renvoie l'ancienne pour
 * qu'elle soit supprimée du stockage. */
export async function setAvatar(db: Db, me: Me, storageKey: string | null) {
  const [before] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, me.id));
  await db
    .update(users)
    .set({ avatarKey: storageKey, updatedAt: new Date() })
    .where(eq(users.id, me.id));
  return before?.avatarKey ?? null;
}

// --- Préférences ----------------------------------------------------------------------

export async function updatePreferences(db: Db, me: Me, patch: PreferencesPatch) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, me.id));
    if (!row) fail("Compte introuvable.");
    const current = readPreferences(row.preferences);
    const next: UserPreferences = { ...current, payout: { ...current.payout } };
    if (patch.mutedNotifications) {
      const allowed = MUTABLE_BY_ROLE[me.role];
      next.mutedNotifications = [...new Set(patch.mutedNotifications)].filter((t) =>
        allowed.includes(t),
      );
    }
    if (patch.newsletter !== undefined) next.newsletter = patch.newsletter === true;
    if (patch.payout) {
      if (me.role !== "farmer" && me.role !== "driver") fail("Pas de retrait pour ce compte.");
      const number = (raw: string | undefined, prev: string) =>
        raw === undefined ? prev : raw.trim() ? normalizeWalletNumber(raw) : "";
      next.payout.wave = number(patch.payout.wave, current.payout.wave);
      next.payout.orangeMoney = number(patch.payout.orangeMoney, current.payout.orangeMoney);
      if (patch.payout.primary) next.payout.primary = patch.payout.primary;
      const primaryNumber =
        next.payout.primary === "wave" ? next.payout.wave : next.payout.orangeMoney;
      if (!primaryNumber) fail("Renseignez le numéro du moyen de retrait préféré.");
    }
    await tx
      .update(users)
      .set({ preferences: next, updatedAt: new Date() })
      .where(eq(users.id, me.id));
    // Un changement de numéro de retrait est sensible : il reste au journal.
    if (
      next.payout.wave !== current.payout.wave ||
      next.payout.orangeMoney !== current.payout.orangeMoney
    ) {
      await audit(tx, {
        actorId: me.id,
        action: "Numéros de retrait modifiés",
        targetType: "user",
        targetId: me.id,
        before: current.payout,
        after: next.payout,
      });
    }
    return next;
  });
}

// --- Restaurant -----------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function receptionHours(raw: ReceptionHoursSetting): ReceptionHoursSetting {
  const out: ReceptionHoursSetting = {};
  for (const day of RECEPTION_DAYS) {
    const slot = raw[day];
    if (!slot) fail(`Créneau manquant : ${day}.`);
    const open = slot.open === true;
    if (!TIME.test(slot.from) || !TIME.test(slot.to)) fail(`${day} : heure invalide.`);
    if (open && slot.from >= slot.to) fail(`${day} : l'heure de fin doit suivre l'heure de début.`);
    out[day] = { open, from: slot.from, to: slot.to };
  }
  if (!Object.values(out).some((s) => s.open)) fail("Ouvrez au moins un jour de réception.");
  return out;
}

export async function updateRestaurant(db: Db, me: Me, patch: RestaurantPatch) {
  if (me.role !== "restaurant") fail("Réservé aux restaurants.");
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(restaurants).where(eq(restaurants.userId, me.id));
    if (!before) fail("Établissement introuvable.");
    const set: Partial<typeof restaurants.$inferInsert> = {};
    if (patch.name !== undefined) set.name = text(patch.name, "Nom de l'établissement", 2, 120);
    if (patch.cuisine !== undefined)
      set.cuisine = text(patch.cuisine, "Type de cuisine", 0, 60) || null;
    if (patch.description !== undefined)
      set.description = text(patch.description, "Présentation", 0, 600) || null;
    if (patch.contactName !== undefined)
      set.contactName = text(patch.contactName, "Responsable des achats", 0, 120) || null;
    if (patch.capacity !== undefined) {
      const c = patch.capacity;
      if (c !== null && (!Number.isInteger(c) || c < 0 || c > 10_000)) fail("Capacité invalide.");
      set.capacity = c;
    }
    if (patch.address !== undefined) set.address = text(patch.address, "Adresse", 10, 200);
    if (patch.ninea !== undefined) {
      const n = text(patch.ninea, "NINEA", 0, 40);
      if (n && !/^[0-9A-Za-z ]{7,40}$/.test(n)) fail("NINEA invalide.");
      set.ninea = n || null;
    }
    if (patch.billingEmail !== undefined) {
      const e = normalizeEmail(patch.billingEmail);
      if (!/^\S+@\S+\.\S+$/.test(e) || e.length > 200) fail("Email de facturation invalide.");
      set.billingEmail = e;
    }
    if (patch.receptionHours !== undefined)
      set.receptionHours = receptionHours(patch.receptionHours);
    if (Object.keys(set).length === 0) return;
    await tx
      .update(restaurants)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(restaurants.userId, me.id));
    await audit(tx, {
      actorId: me.id,
      action: "Fiche établissement modifiée",
      targetType: "restaurant",
      targetId: me.id,
      after: set,
    });
  });
}

// --- Producteur -----------------------------------------------------------------------

export async function updateFarm(db: Db, me: Me, patch: FarmPatch) {
  if (me.role !== "farmer") fail("Réservé aux producteurs.");
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(farmers).where(eq(farmers.userId, me.id));
    if (!before) fail("Exploitation introuvable.");
    const set: Partial<typeof farmers.$inferInsert> = {};
    if (patch.name !== undefined) set.farmName = text(patch.name, "Nom de l'exploitation", 2, 120);
    if (patch.address !== undefined) {
      set.pickupAddress = text(patch.address, "Adresse de collecte", 5, 200);
      // Le lieu de collecte a changé : la position précise posée par l'équipe
      // ne vaut plus, la distance des livraisons repart de la nouvelle adresse.
      if (set.pickupAddress !== before.pickupAddress && before.lat != null) {
        set.lat = null;
        set.lng = null;
        await notifyOpsStaff(
          tx,
          {
            type: "system",
            title: "Adresse de collecte modifiée",
            body: `${before.farmName} : « ${set.pickupAddress} ». Replacez sa position dans Tarifs de livraison.`,
            link: "/admin/delivery-pricing",
          },
          "users.edit",
        );
      }
    }
    if (patch.areaHa !== undefined) {
      const a = patch.areaHa;
      if (a !== null && (!Number.isFinite(a) || a <= 0 || a > 100_000))
        fail("Superficie invalide.");
      set.areaHa = a === null ? null : Math.round(a * 100) / 100;
    }
    if (patch.certification !== undefined) set.certification = patch.certification;
    if (patch.productionTypes !== undefined) {
      const types = [...new Set(patch.productionTypes.map((t) => t.trim()).filter(Boolean))];
      if (types.length > 20 || types.some((t) => t.length > 60))
        fail("Types de produits invalides.");
      set.productionTypes = types;
    }
    if (patch.description !== undefined)
      set.description = text(patch.description, "Présentation", 0, 600) || null;
    if (patch.lang !== undefined) set.lang = patch.lang === "wo" ? "wo" : "fr";
    if (Object.keys(set).length === 0) return;
    await tx
      .update(farmers)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(farmers.userId, me.id));
    await audit(tx, {
      actorId: me.id,
      action: "Fiche exploitation modifiée",
      targetType: "farmer",
      targetId: me.id,
      after: set,
    });
  });
}

// --- Livreur --------------------------------------------------------------------------

export async function updateDriver(db: Db, me: Me, patch: { address?: string }) {
  if (me.role !== "driver") fail("Réservé aux livreurs.");
  if (patch.address === undefined) return;
  await db
    .update(drivers)
    .set({ address: text(patch.address, "Adresse", 0, 200) || null, updatedAt: new Date() })
    .where(eq(drivers.userId, me.id));
}

// --- Suppression du compte --------------------------------------------------------------

/** Demande de suppression : l'équipe la traite (soldes à verser, commandes
 * en cours) avant d'anonymiser le compte. */
export async function requestAccountDeletion(db: Db, me: Me, reason: string) {
  const [u] = await db.select().from(users).where(eq(users.id, me.id));
  if (!u) fail("Compte introuvable.");
  await notifyOpsStaff(
    db,
    {
      type: "system",
      title: "Demande de suppression de compte",
      body: `${u.firstName} ${u.lastName} (${u.email})${reason.trim() ? ` : ${reason.trim().slice(0, 200)}` : ""}`,
      link: `/admin/users/${me.id}`,
    },
    "users.suspend",
  );
  await audit(db, {
    actorId: me.id,
    action: "Suppression du compte demandée",
    targetType: "user",
    targetId: me.id,
    after: { reason: reason.trim().slice(0, 500) },
  });
}

export { DEFAULT_PREFERENCES };
