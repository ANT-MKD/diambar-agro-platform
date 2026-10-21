// Positions GPS réelles des livreurs (tests sur une vraie base PostgreSQL,
// fichier « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { drivers, missionPositions, missions, products, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { createSignedToken } from "@/lib/auth/tokens.server";
import { confirmOrder, placeOrder } from "./market-db.server";
import { readDriverPositions, readMissionTrack, reportPosition } from "./positions-db.server";
import { readSnapshot } from "./snapshot.server";
import { handleDriverPosition } from "./gps-endpoint.server";

// Le vrai module de session dépend du serveur TanStack : secret de test ici.
vi.mock("@/lib/auth/session.server", () => ({
  getSessionSecret: () => "secret-de-test-uniquement-0123456789abcdef",
}));

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_positions_test";
// Dakar Plateau, puis ~200 m plus loin.
const A = { lat: 14.6681, lng: -17.4377 };
const B = { lat: 14.6699, lng: -17.4377 };

describe.skipIf(!adminUrl)("positions GPS des livreurs (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let dbUrl: string;
  let driverId: string;
  let adminId: string;
  let restaurantId: string;
  let farmerId: string;
  let missionId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const setMission = (status: "accepted" | "pickup" | "loaded" | "delivered") =>
    db.update(missions).set({ status, driverId }).where(eq(missions.id, missionId));
  const lastOf = async () =>
    (await db.select().from(drivers).where(eq(drivers.userId, driverId)))[0];
  const trackCount = async () =>
    (await db.select().from(missionPositions).where(eq(missionPositions.missionId, missionId)))
      .length;

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const u = new URL(adminUrl!);
    u.pathname = `/${DB_NAME}`;
    dbUrl = u.toString();
    ({ db, close } = createDb(dbUrl, { max: 4 }));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
    driverId = await idOf("livreur@diambar.sn");
    adminId = await idOf("admin@diambar.sn");
    farmerId = await idOf("agriculteur@diambar.sn");
    restaurantId = await idOf("restaurant@diambar.sn");
    // Les courses de démonstration du livreur sont mises de côté : seule la
    // course de ce test compte.
    await db.update(missions).set({ status: "delivered" }).where(eq(missions.driverId, driverId));

    const [tomato] = await db.select().from(products).where(eq(products.farmerId, farmerId));
    await db
      .update(products)
      .set({ stockQty: 500, status: "active" })
      .where(eq(products.id, tomato.id));
    const slot = new Date();
    slot.setUTCDate(slot.getUTCDate() + 2);
    slot.setUTCHours(9, 0, 0, 0);
    const placed = await placeOrder(db, restaurantId, {
      lines: [{ productId: tomato.id, qty: 10 }],
      deliveryAddress: "Le Baobab, Dakar Plateau",
      slotStart: slot.toISOString(),
      slotLabel: "Dans 2 jours · 09:00",
      paymentMethod: "Espèces",
      shortagePreference: "partial",
    });
    await confirmOrder(db, farmerId, placed.orders[0].id, {});
    const [m] = await db.select().from(missions).where(eq(missions.orderId, placed.orders[0].id));
    missionId = m.id;
  }, 120_000);

  afterAll(async () => {
    await close?.();
  });

  it("sans course démarrée, rien n'est enregistré et le téléphone peut s'arrêter", async () => {
    await db.update(drivers).set({ isOnline: true }).where(eq(drivers.userId, driverId));
    await setMission("accepted");
    expect(await reportPosition(db, driverId, A)).toEqual({ tracking: false });
    expect((await lastOf()).lastLat).toBeNull();
    expect(await trackCount()).toBe(0);
  });

  it("course démarrée : dernière position et trajet enregistrés", async () => {
    await setMission("pickup");
    const t0 = new Date();
    const res = await reportPosition(
      db,
      driverId,
      { ...A, accuracy: 12, heading: 370, speedKmh: 25, at: t0.getTime() },
      t0,
    );
    expect(res).toEqual({ tracking: true });
    const d = await lastOf();
    expect(d.lastLat).toBeCloseTo(A.lat, 6);
    expect(d.lastHeading).toBe(10);
    expect(d.lastSpeedKmh).toBe(25);
    expect(await trackCount()).toBe(1);
  });

  it("trajet : un point au plus toutes les 15 s, sauf déplacement de plus de 50 m", async () => {
    const base = Date.now() + 1_000;
    // 5 s plus tard, au même endroit : pas de nouveau point.
    await reportPosition(db, driverId, { ...A, at: base + 5_000 }, new Date(base + 5_000));
    expect(await trackCount()).toBe(1);
    // 5 s plus tard, 200 m plus loin : nouveau point.
    await reportPosition(db, driverId, { ...B, at: base + 10_000 }, new Date(base + 10_000));
    expect(await trackCount()).toBe(2);
    // Imprécis (300 m) : la dernière position change, pas le trajet.
    await reportPosition(
      db,
      driverId,
      { ...A, accuracy: 300, at: base + 40_000 },
      new Date(base + 40_000),
    );
    expect(await trackCount()).toBe(2);
    expect((await lastOf()).lastAccuracyM).toBe(300);
    expect(await readMissionTrack(db, missionId)).toHaveLength(2);
  });

  it("une mesure plus ancienne ne remplace pas la dernière ; trop ancienne, elle est ignorée", async () => {
    const before = await lastOf();
    const older = before.lastPositionAt!.getTime() - 60_000;
    await reportPosition(db, driverId, { ...B, at: older });
    expect((await lastOf()).lastPositionAt!.getTime()).toBe(before.lastPositionAt!.getTime());
    const count = await trackCount();
    await reportPosition(db, driverId, { ...B, at: Date.now() - 31 * 60_000 });
    expect(await trackCount()).toBe(count);
    await expect(reportPosition(db, driverId, { lat: 0, lng: 0 })).rejects.toThrow(/invalide/);
    await expect(reportPosition(db, driverId, { lat: 95, lng: 2 })).rejects.toThrow(/invalide/);
  });

  it("position visible : équipe et livreur pendant la course, restaurant seulement en livraison et si partagée", async () => {
    // Plus récente que les mesures du test précédent (datées jusqu'à +41 s).
    const t = new Date(Date.now() + 60_000);
    await reportPosition(db, driverId, { ...B, at: t.getTime() }, t);
    const seen = async (id: string, role: "admin" | "driver" | "restaurant" | "farmer") =>
      (await readSnapshot(db, { id, role })).missions.find((m) => m.id === missionId)
        ?.driverPosition;

    // Vers la collecte : pas le restaurant.
    expect(await seen(adminId, "admin")).toBeDefined();
    expect(await seen(driverId, "driver")).toBeDefined();
    expect(await seen(restaurantId, "restaurant")).toBeUndefined();
    expect(await seen(farmerId, "farmer")).toBeUndefined();

    // En livraison : le restaurant la voit…
    await setMission("loaded");
    const pos = await seen(restaurantId, "restaurant");
    expect(pos?.lat).toBeCloseTo(B.lat, 6);
    expect(pos && "sharing" in pos).toBe(false);
    // … sauf si le livreur a désactivé le partage.
    await db.update(drivers).set({ locationSharing: false }).where(eq(drivers.userId, driverId));
    expect(await seen(restaurantId, "restaurant")).toBeUndefined();
    expect(await seen(adminId, "admin")).toBeDefined();
    await db.update(drivers).set({ locationSharing: true }).where(eq(drivers.userId, driverId));

    // Course livrée : plus de position ; le trajet reste pour l'équipe.
    await setMission("delivered");
    expect(await seen(adminId, "admin")).toBeUndefined();
    expect((await readMissionTrack(db, missionId)).length).toBeGreaterThan(1);
  });

  it("une position de plus de 30 min n'est plus montrée", async () => {
    const later = new Date(Date.now() + 35 * 60_000);
    expect((await readDriverPositions(db, [driverId], later)).size).toBe(0);
    expect((await readDriverPositions(db, [driverId])).size).toBe(1);
  });

  it("POST /api/driver-position : jeton signé obligatoire", async () => {
    const prevUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = dbUrl;
    try {
      await setMission("loaded");
      const post = (body: unknown, token?: string) =>
        handleDriverPosition(
          new Request("http://localhost/api/driver-position", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          }),
        );
      expect((await post({ ...A })).status).toBe(401);
      const wrongKind = await createSignedToken({ kind: "login", driverId }, 60_000);
      expect((await post({ ...A }, wrongKind)).status).toBe(401);
      const token = await createSignedToken({ kind: "gps", driverId }, 60_000);
      expect((await post({ lat: "x" }, token)).status).toBe(400);
      const ok = await post({ ...A, accuracy: 8, at: Date.now() }, token);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ ok: true, tracking: true });
      await setMission("delivered");
      expect(await (await post({ ...A, at: Date.now() }, token)).json()).toEqual({
        ok: true,
        tracking: false,
      });
    } finally {
      process.env.DATABASE_URL = prevUrl;
    }
  });
});
