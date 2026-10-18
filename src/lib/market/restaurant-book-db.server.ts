import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  farmers,
  orders,
  productFavorites,
  products,
  restaurantSuppliers,
  restaurants,
  users,
} from "@/db/schema";
import type { Supplier } from "@/data/mocks";
import type { BudgetState } from "@/data/budget";
import { fail, type Q } from "./market-common.server";

// Carnet du restaurant en base : ses fournisseurs (producteurs de la
// plateforme ou fournisseurs extérieurs), favoris et suspensions, ses produits
// favoris et son budget d'achat. Rien n'est partagé avec les autres restaurants.

export type SupplierInput = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  city?: string;
  notes?: string;
  farmerId?: string | null;
  favorite?: boolean;
  suspended?: boolean;
};

const clean = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);

export async function createSupplier(db: Db, restaurantId: string, input: SupplierInput) {
  const name = clean(input.name, 120);
  if (name.length < 2) fail("Indiquez le nom du fournisseur.");
  if (input.farmerId) {
    const [f] = await db
      .select({ id: farmers.userId })
      .from(farmers)
      .where(eq(farmers.userId, input.farmerId));
    if (!f) fail("Producteur introuvable.");
    const [already] = await db
      .select({ id: restaurantSuppliers.id })
      .from(restaurantSuppliers)
      .where(
        and(
          eq(restaurantSuppliers.restaurantId, restaurantId),
          eq(restaurantSuppliers.farmerId, input.farmerId),
        ),
      );
    if (already) fail("Ce producteur est déjà dans vos fournisseurs.");
  }
  const [row] = await db
    .insert(restaurantSuppliers)
    .values({
      restaurantId,
      farmerId: input.farmerId ?? null,
      name,
      contact: clean(input.contact, 120),
      phone: clean(input.phone, 30),
      email: clean(input.email, 160),
      city: clean(input.city, 80),
      notes: clean(input.notes, 1000) || null,
      favorite: !!input.favorite,
      suspended: !!input.suspended,
    })
    .returning({ id: restaurantSuppliers.id });
  return row.id;
}

async function mine(db: Q, restaurantId: string, id: string) {
  const [s] = await db
    .select()
    .from(restaurantSuppliers)
    .where(and(eq(restaurantSuppliers.id, id), eq(restaurantSuppliers.restaurantId, restaurantId)));
  if (!s) fail("Fournisseur introuvable.");
  return s;
}

export async function updateSupplier(
  db: Db,
  restaurantId: string,
  id: string,
  patch: Partial<SupplierInput>,
) {
  const s = await mine(db, restaurantId, id);
  const set: Partial<typeof restaurantSuppliers.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = clean(patch.name, 120);
    if (name.length < 2) fail("Indiquez le nom du fournisseur.");
    set.name = name;
  }
  if (patch.contact !== undefined) set.contact = clean(patch.contact, 120);
  if (patch.phone !== undefined) set.phone = clean(patch.phone, 30);
  if (patch.email !== undefined) set.email = clean(patch.email, 160);
  if (patch.city !== undefined) set.city = clean(patch.city, 80);
  if (patch.notes !== undefined) set.notes = clean(patch.notes, 1000) || null;
  if (patch.favorite !== undefined) set.favorite = patch.favorite;
  if (patch.suspended !== undefined) set.suspended = patch.suspended;
  await db.update(restaurantSuppliers).set(set).where(eq(restaurantSuppliers.id, s.id));
}

/** Retire une fiche du carnet. Un producteur déjà commandé y reviendra à la
 * prochaine commande. */
export async function removeSupplier(db: Db, restaurantId: string, id: string) {
  const s = await mine(db, restaurantId, id);
  await db.delete(restaurantSuppliers).where(eq(restaurantSuppliers.id, s.id));
}

export async function toggleFavoriteProduct(db: Db, restaurantId: string, productId: string) {
  const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
  if (!p) fail("Produit introuvable.");
  const removed = await db
    .delete(productFavorites)
    .where(
      and(
        eq(productFavorites.restaurantId, restaurantId),
        eq(productFavorites.productId, productId),
      ),
    )
    .returning({ id: productFavorites.productId });
  if (!removed.length) {
    await db.insert(productFavorites).values({ restaurantId, productId }).onConflictDoNothing();
  }
  return !removed.length;
}

export async function clearFavoriteProducts(db: Db, restaurantId: string) {
  await db.delete(productFavorites).where(eq(productFavorites.restaurantId, restaurantId));
}

export async function saveBudget(db: Db, restaurantId: string, budget: BudgetState) {
  const monthly = Math.round(budget.monthly);
  if (!(monthly >= 0) || monthly > 10_000_000_000) fail("Budget mensuel invalide.");
  const threshold = Math.round(budget.alertThreshold);
  if (!(threshold >= 10 && threshold <= 100)) fail("Seuil d'alerte entre 10 et 100 %.");
  const categories = budget.categories.slice(0, 20).map((c) => ({
    key: clean(c.key, 40),
    label: clean(c.label, 60),
    allocated: Math.max(0, Math.round(c.allocated)),
  }));
  await db
    .update(restaurants)
    .set({ budget: { monthly, alertThreshold: threshold, categories }, updatedAt: new Date() })
    .where(eq(restaurants.userId, restaurantId));
}

// --- Lecture ---------------------------------------------------------------------

export type RestaurantBook = {
  suppliers: Supplier[];
  favorites: string[];
  budget: BudgetState | null;
};

export async function readRestaurantBook(q: Q, restaurantId: string): Promise<RestaurantBook> {
  const [rows, favs, [resto]] = await Promise.all([
    q
      .select()
      .from(restaurantSuppliers)
      .where(eq(restaurantSuppliers.restaurantId, restaurantId))
      .orderBy(desc(restaurantSuppliers.createdAt)),
    q
      .select({ productId: productFavorites.productId })
      .from(productFavorites)
      .where(eq(productFavorites.restaurantId, restaurantId)),
    q
      .select({ budget: restaurants.budget })
      .from(restaurants)
      .where(eq(restaurants.userId, restaurantId)),
  ]);
  const farmerIds = rows.flatMap((r) => (r.farmerId ? [r.farmerId] : []));
  const [stats, people] = farmerIds.length
    ? await Promise.all([
        q
          .select({
            farmerId: orders.farmerId,
            n: sql<number>`count(*)::int`,
            spent: sql<number>`coalesce(sum(${orders.subtotal} + ${orders.deliveryFee} - ${orders.discount}), 0)::int`,
            last: sql<string>`max(${orders.createdAt})::text`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.restaurantId, restaurantId),
              inArray(orders.farmerId, farmerIds),
              ne(orders.status, "cancelled"),
            ),
          )
          .groupBy(orders.farmerId),
        q
          .select({
            id: users.id,
            phone: users.phone,
            email: users.email,
            first: users.firstName,
            last: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, farmerIds)),
      ])
    : [[], []];
  return {
    suppliers: rows.map((r) => {
      const st = stats.find((x) => x.farmerId === r.farmerId);
      const p = people.find((x) => x.id === r.farmerId);
      return {
        id: r.id,
        restaurantId: r.restaurantId,
        farmerId: r.farmerId ?? undefined,
        name: r.name,
        // Coordonnées du producteur de la plateforme quand la fiche n'en a pas.
        contact: r.contact || (p ? `${p.first} ${p.last}`.trim() : ""),
        phone: r.phone || p?.phone || "",
        email: r.email || p?.email || "",
        city: r.city,
        notes: r.notes ?? undefined,
        favorite: r.favorite,
        suspended: r.suspended,
        lastOrder: st?.last ? new Date(st.last).toISOString().slice(0, 10) : "—",
        totalOrders: st?.n ?? 0,
        totalSpent: st?.spent ?? 0,
      } satisfies Supplier;
    }),
    favorites: favs.map((f) => f.productId),
    budget: (resto?.budget as BudgetState | null) ?? null,
  };
}
