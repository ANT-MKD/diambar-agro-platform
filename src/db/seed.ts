// Données de départ de la base.
//
// - seedReference : ce dont l'application a besoin pour fonctionner
//   (catégories, réglages par défaut). Sans danger en production.
// - seedDemo : villes, zones, comptes et produits de démonstration, repris des
//   données de démo actuelles de l'application. Jamais en production.
//
// Les deux fonctions peuvent être relancées : ce qui existe déjà est conservé.
import { hashSync } from "bcryptjs";
import { eq, inArray } from "drizzle-orm";
import { commissionTiers, deliveryZones } from "../data/admin-mocks.ts";
import { demoAccounts } from "../data/demo-accounts.ts";
import { products as demoProducts } from "../data/mocks.ts";
import { DAKAR_ZONES } from "../lib/platform/setup-model.ts";
import type { Db } from "./client.server.ts";
import {
  adminProfiles,
  categories,
  cities,
  driverZones,
  drivers,
  farmers,
  products,
  restaurants,
  settings,
  users,
  vehicles,
  zones,
} from "./schema.ts";

export const CATEGORY_NAMES = [
  "Légumes",
  "Fruits",
  "Tubercules",
  "Céréales",
  "Épices",
  "Viande",
  "Volaille",
] as const;

/** Réglages par défaut, modifiables par l'admin (assistant d'installation, lot 1.1). */
export const DEFAULT_SETTINGS: Record<string, unknown> = {
  // Heure limite pour être livré le lendemain matin.
  cutoff_hour: 18,
  // Même valeur que MIN_ORDER_PER_PRODUCER (src/lib/pricing.ts).
  min_order_per_producer: 5000,
  // Délai pour signaler un produit abîmé ou manquant.
  reception_window_hours: 48,
  // Paiement Wave / Orange Money attendu au plus tard la veille du créneau à 20 h.
  payment_deadline_hour: 20,
  commission_tiers: commissionTiers.map(({ label, rate, min, max }) => ({ label, rate, min, max })),
  tva: { enabled: false, rate: 18 },
};

export async function seedReference(db: Db) {
  const insertedCategories = await db
    .insert(categories)
    .values(CATEGORY_NAMES.map((name, i) => ({ name, sortOrder: i + 1 })))
    .onConflictDoNothing()
    .returning({ id: categories.id });
  const insertedSettings = await db
    .insert(settings)
    .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing()
    .returning({ key: settings.key });
  return { categories: insertedCategories.length, settings: insertedSettings.length };
}

type DemoPerson = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  status: "active" | "pending" | "suspended";
};

// Personnes derrière les comptes de démo (src/data/demo-accounts.ts) ; les
// numéros de démo sont fictifs.
const DEMO_PEOPLE: Record<string, DemoPerson> = {
  "agriculteur@diambar.sn": {
    firstName: "Mamadou",
    lastName: "Diallo",
    phone: "771234567",
    city: "Thiès",
    status: "active",
  },
  "restaurant@diambar.sn": {
    firstName: "Fatou",
    lastName: "Sarr",
    phone: "771234568",
    city: "Dakar",
    status: "active",
  },
  "livreur@diambar.sn": {
    firstName: "Oumar",
    lastName: "Ba",
    phone: "771234569",
    city: "Dakar",
    status: "active",
  },
  "admin@diambar.sn": {
    firstName: "Admin",
    lastName: "Diambar",
    phone: "771234570",
    city: "Dakar",
    status: "active",
  },
  "finance@diambar.sn": {
    firstName: "Fatou",
    lastName: "Ndiaye",
    phone: "771234571",
    city: "Dakar",
    status: "active",
  },
  "ops@diambar.sn": {
    firstName: "Ibrahima",
    lastName: "Fall",
    phone: "771234572",
    city: "Dakar",
    status: "active",
  },
  "awa.camara@gmail.com": {
    firstName: "Awa",
    lastName: "Camara",
    phone: "704110812",
    city: "Saint-Louis",
    status: "pending",
  },
  "keurmassar.dib@gmail.com": {
    firstName: "Dibiterie",
    lastName: "Keur Massar",
    phone: "763304410",
    city: "Dakar",
    status: "suspended",
  },
};

const ADMIN_ROLES: Record<string, "super_admin" | "finance" | "operations"> = {
  "admin@diambar.sn": "super_admin",
  "finance@diambar.sn": "finance",
  "ops@diambar.sn": "operations",
};

export async function seedDemo(db: Db) {
  // Villes (barème actuel de l'app) et zones de Dakar.
  await db
    .insert(cities)
    .values(
      deliveryZones.map((z) => ({
        name: z.name,
        active: z.active,
        baseFee: z.baseFee,
        perKmFee: z.perKm,
      })),
    )
    .onConflictDoNothing();
  const cityRows = await db.select().from(cities);
  const cityId = (name: string) => cityRows.find((c) => c.name === name)?.id ?? null;
  const dakarId = cityId("Dakar");
  if (!dakarId) throw new Error("Ville Dakar absente du référentiel de démo");
  await db
    .insert(zones)
    .values(DAKAR_ZONES.map((name) => ({ cityId: dakarId, name })))
    .onConflictDoNothing();
  const zoneRows = await db.select().from(zones).where(eq(zones.cityId, dakarId));
  const zoneId = (name: string) => zoneRows.find((z) => z.name === name)?.id ?? null;

  // Comptes : mot de passe de démo brouillé (bcrypt), jamais en clair.
  const now = new Date();
  const accounts = demoAccounts.filter((a) => DEMO_PEOPLE[a.email]);
  const insertedUsers = await db
    .insert(users)
    .values(
      accounts.map((a) => {
        const p = DEMO_PEOPLE[a.email];
        return {
          role: a.role,
          email: a.email.toLowerCase(),
          phone: p.phone,
          passwordHash: hashSync(a.password, 10),
          firstName: p.firstName,
          lastName: p.lastName,
          status: p.status,
          twoFaEnabled: !!a.twoFaEnabled,
          phoneVerifiedAt: p.status === "pending" ? null : now,
          emailVerifiedAt: p.status === "pending" ? null : now,
          acceptedTermsAt: now,
          cityId: cityId(p.city),
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: users.id });
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, Object.keys(DEMO_PEOPLE)));
  const userId = (email: string) => {
    const id = userRows.find((u) => u.email === email)?.id;
    if (!id) throw new Error(`Compte de démo introuvable : ${email}`);
    return id;
  };

  await db
    .insert(adminProfiles)
    .values(
      Object.entries(ADMIN_ROLES).map(([email, adminRole]) => ({
        userId: userId(email),
        adminRole,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(farmers)
    .values([
      {
        userId: userId("agriculteur@diambar.sn"),
        farmName: "Ferme Diallo",
        pickupAddress: "Route de Khombole, km 3, Thiès",
        certification: "bio",
        areaHa: 5.5,
      },
      {
        userId: userId("awa.camara@gmail.com"),
        farmName: "Exploitation Camara",
        pickupAddress: "Saint-Louis",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(restaurants)
    .values([
      {
        userId: userId("restaurant@diambar.sn"),
        name: "Le Baobab",
        cuisine: "Sénégalaise",
        address: "Le Baobab, Dakar Plateau",
        zoneId: zoneId("Plateau"),
        billingEmail: "restaurant@diambar.sn",
      },
      {
        userId: userId("keurmassar.dib@gmail.com"),
        name: "Dibiterie Keur Massar",
        cuisine: "Grillades",
        address: "Keur Massar, Dakar",
        zoneId: zoneId("Keur Massar"),
      },
    ])
    .onConflictDoNothing();

  const driverId = userId("livreur@diambar.sn");
  await db
    .insert(drivers)
    .values({ userId: driverId, licenseNumber: "SN-2024-8891", isOnline: false })
    .onConflictDoNothing();
  await db
    .insert(driverZones)
    .values(
      ["Plateau", "Médina", "Fann – Point E – Amitié"].flatMap((name) => {
        const id = zoneId(name);
        return id ? [{ driverId, zoneId: id }] : [];
      }),
    )
    .onConflictDoNothing();
  const existingVehicles = await db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  if (existingVehicles.length === 0) {
    await db
      .insert(vehicles)
      .values({ driverId, type: "moto", plate: "DK-1234-AB", capacityKg: 80 });
  }

  // Produits du producteur de démo (ceux de « f1 » dans les données actuelles).
  const farmerId = userId("agriculteur@diambar.sn");
  const categoryRows = await db.select().from(categories);
  const existingProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.farmerId, farmerId));
  let productCount = 0;
  if (existingProducts.length === 0) {
    const rows = demoProducts
      .filter((p) => p.farmerId === "f1")
      .map((p) => {
        const category = categoryRows.find((c) => c.name === p.category);
        if (!category) throw new Error(`Catégorie inconnue : ${p.category}`);
        return {
          farmerId,
          categoryId: category.id,
          name: p.name,
          description: p.description ?? null,
          unit: p.unit,
          price: p.pricePerKg,
          stockQty: p.stock,
          minStock: p.minStock,
          minOrderQty: p.minOrder ?? null,
          organic: !!p.organic,
          status:
            p.status === "out"
              ? ("out" as const)
              : p.status === "draft"
                ? ("draft" as const)
                : ("active" as const),
        };
      });
    productCount = (await db.insert(products).values(rows).returning({ id: products.id })).length;
  }

  // Plateforme de démonstration : déjà configurée, inscriptions ouvertes.
  await db
    .insert(settings)
    .values([
      { key: "registrations_open", value: true },
      { key: "platform_setup", value: { completedAt: now.toISOString(), demo: true } },
    ])
    .onConflictDoNothing();

  return {
    cities: cityRows.length,
    zones: zoneRows.length,
    users: insertedUsers.length,
    products: productCount,
  };
}
