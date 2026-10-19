// Carnet du restaurant en base (tests sur une vraie base PostgreSQL, fichier
// « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { products, restaurantSuppliers, settings, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { placeOrder } from "./market-db.server";
import {
  clearFavoriteProducts,
  createSupplier,
  readRestaurantBook,
  removeSupplier,
  saveBudget,
  toggleFavoriteProduct,
  updateSupplier,
} from "./restaurant-book-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_book_test";

describe.skipIf(!adminUrl)("carnet du restaurant (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let restaurantId: string;
  let otherRestaurantId: string;
  let farmerId: string;
  let tomatoId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const order = () => {
    const slot = new Date();
    slot.setUTCDate(slot.getUTCDate() + 3);
    slot.setUTCHours(9, 0, 0, 0);
    return placeOrder(db, restaurantId, {
      lines: [{ productId: tomatoId, qty: 10 }],
      deliveryAddress: "Le Baobab, Dakar Plateau",
      slotStart: slot.toISOString(),
      slotLabel: "Dans 3 jours · 09:00",
      paymentMethod: "Espèces",
      shortagePreference: "partial",
    });
  };

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const u = new URL(adminUrl!);
    u.pathname = `/${DB_NAME}`;
    ({ db, close } = createDb(u.toString(), { max: 4 }));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
    restaurantId = await idOf("restaurant@diambar.sn");
    otherRestaurantId = await idOf("keurmassar.dib@gmail.com");
    farmerId = await idOf("agriculteur@diambar.sn");
    const [tomato] = await db.select().from(products).where(eq(products.farmerId, farmerId));
    tomatoId = tomato.id;
    await db
      .update(products)
      .set({ stockQty: 500, status: "active" })
      .where(eq(products.id, tomatoId));
    await db
      .insert(settings)
      .values({
        key: "payment_methods",
        value: {
          wave: { enabled: true, number: "770000000" },
          orangeMoney: { enabled: false, number: "" },
          cashOnDelivery: { enabled: true },
        },
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await close?.();
  });

  it("le producteur entre au carnet à la première commande, avec ses statistiques", async () => {
    await order();
    const book = await readRestaurantBook(db, restaurantId);
    const s = book.suppliers.find((x) => x.farmerId === farmerId)!;
    expect(s).toBeTruthy();
    expect(s.totalOrders).toBe(1);
    expect(s.totalSpent).toBeGreaterThan(0);
    expect(s.lastOrder).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Coordonnées reprises du compte du producteur, rien d'inventé.
    expect(s.email).toBe("agriculteur@diambar.sn");
    expect((await readRestaurantBook(db, otherRestaurantId)).suppliers).toHaveLength(0);
  });

  it("fournisseur suspendu : plus de commande chez lui", async () => {
    const [row] = await db
      .select()
      .from(restaurantSuppliers)
      .where(
        and(
          eq(restaurantSuppliers.restaurantId, restaurantId),
          eq(restaurantSuppliers.farmerId, farmerId),
        ),
      );
    await updateSupplier(db, restaurantId, row.id, { suspended: true, favorite: true });
    await expect(order()).rejects.toThrow(/suspendu/);
    await expect(
      updateSupplier(db, otherRestaurantId, row.id, { suspended: false }),
    ).rejects.toThrow(/introuvable/);
    await updateSupplier(db, restaurantId, row.id, { suspended: false });
    await order();
    const s = (await readRestaurantBook(db, restaurantId)).suppliers.find(
      (x) => x.farmerId === farmerId,
    );
    expect(s).toMatchObject({ favorite: true, suspended: false, totalOrders: 2 });
  });

  it("fournisseur extérieur : création, doublon refusé, suppression", async () => {
    await expect(createSupplier(db, restaurantId, { name: "X" })).rejects.toThrow(/nom/);
    const id = await createSupplier(db, restaurantId, {
      name: "Marché de Thiaroye",
      contact: "Responsable",
      city: "Thiaroye",
    });
    await expect(createSupplier(db, restaurantId, { name: "Doublon", farmerId })).rejects.toThrow(
      /déjà/,
    );
    let book = await readRestaurantBook(db, restaurantId);
    expect(book.suppliers.find((s) => s.id === id)).toMatchObject({
      name: "Marché de Thiaroye",
      totalOrders: 0,
      lastOrder: "—",
    });
    await removeSupplier(db, restaurantId, id);
    book = await readRestaurantBook(db, restaurantId);
    expect(book.suppliers.some((s) => s.id === id)).toBe(false);
  });

  it("produits favoris et budget d'achat", async () => {
    expect(await toggleFavoriteProduct(db, restaurantId, tomatoId)).toBe(true);
    expect((await readRestaurantBook(db, restaurantId)).favorites).toEqual([tomatoId]);
    expect(await toggleFavoriteProduct(db, restaurantId, tomatoId)).toBe(false);
    await toggleFavoriteProduct(db, restaurantId, tomatoId);
    await clearFavoriteProducts(db, restaurantId);
    expect((await readRestaurantBook(db, restaurantId)).favorites).toEqual([]);
    await expect(
      saveBudget(db, restaurantId, { monthly: 500000, alertThreshold: 5, categories: [] }),
    ).rejects.toThrow(/Seuil/);
    await saveBudget(db, restaurantId, {
      monthly: 500000,
      alertThreshold: 75,
      categories: [{ key: "legumes", label: "Légumes", allocated: 200000 }],
    });
    expect((await readRestaurantBook(db, restaurantId)).budget).toMatchObject({
      monthly: 500000,
      alertThreshold: 75,
      categories: [{ key: "legumes", allocated: 200000 }],
    });
  });
});
