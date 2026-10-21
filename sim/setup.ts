// Base JETABLE du runner GitHub (jamais la base en ligne) : migrations,
// données de démonstration, puis une livraison en cours entre une ferme des
// Niayes (Pikine) et un restaurant du Plateau.
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "@/db/client.server";
import { farmers, missions, orders, products, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { confirmOrder, placeOrder } from "@/lib/market/market-db.server";

const url = process.env.SIM_DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("Base locale du runner uniquement.");
const { db, close } = createDb(url, { max: 2 });
await migrate(db, { migrationsFolder: "supabase/migrations" });
await seedReference(db);
await seedDemo(db);

const idOf = async (email: string) =>
  (await db.select().from(users).where(eq(users.email, email)))[0].id;
const driverId = await idOf("livreur@diambar.sn");
const farmerId = await idOf("agriculteur@diambar.sn");
const restaurantId = await idOf("restaurant@diambar.sn");

await db
  .update(farmers)
  .set({ lat: 14.759, lng: -17.388, pickupAddress: "Zone des Niayes, Pikine" })
  .where(eq(farmers.userId, farmerId));
const [p] = await db.select().from(products).where(eq(products.farmerId, farmerId));
await db.update(products).set({ stockQty: 500, status: "active" }).where(eq(products.id, p.id));
const slot = new Date();
slot.setUTCDate(slot.getUTCDate() + 2);
slot.setUTCHours(10, 0, 0, 0);
const placed = await placeOrder(db, restaurantId, {
  lines: [{ productId: p.id, qty: 10 }],
  deliveryAddress: "Le Baobab, Dakar Plateau",
  slotStart: slot.toISOString(),
  slotLabel: "Dans 2 jours · 10:00",
  paymentMethod: "Espèces",
  shortagePreference: "partial",
});
const orderId = placed.orders[0].id;
await confirmOrder(db, farmerId, orderId, {});
const [m] = await db.select().from(missions).where(eq(missions.orderId, orderId));
// Marchandise chargée : le livreur roule vers le restaurant.
await db.update(missions).set({ driverId, status: "loaded" }).where(eq(missions.id, m.id));
await db.update(orders).set({ status: "delivering" }).where(eq(orders.id, orderId));
await db.update(users).set({ twoFaEnabled: false }).where(eq(users.email, "admin@diambar.sn"));
fs.writeFileSync("/tmp/sim.json", JSON.stringify({ missionId: m.id, orderId }));
console.log("Livraison en cours :", m.reference);
await close();
