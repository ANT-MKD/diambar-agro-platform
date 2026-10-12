import { and, asc, desc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  categories,
  checkouts,
  cities,
  deliveryProofs,
  drivers,
  farmers,
  files,
  missionEvents,
  missions,
  notifications,
  orderEvents,
  orderItems,
  orders,
  payments,
  productPhotos,
  products,
  refunds,
  restaurants,
  settings,
  users,
  vehicles,
  zones,
} from "@/db/schema";
import {
  products as demoProducts,
  type AppNotification,
  type Mission,
  type MissionStatus,
  type Order,
  type PaymentMethod,
  type Product,
  type RestaurantOrder,
  type Role,
} from "@/data/mocks";
import { formatSenegalPhone } from "@/lib/auth/helpers";
import { lastAddressSegment, routeEstimate, vehicleForWeight } from "@/lib/mission-pay";
import { cityCoords } from "@/lib/tracking/geo";
import {
  paymentState,
  type AdminPayment,
  type OrderPayment,
  type RefundView,
} from "./payment-view";
import { orderDue, readMerchantAccounts } from "./payments-db.server";
import { isStored, publicUrl, signedUrl } from "./storage.server";
import type {
  DirectoryDriver,
  DirectoryFarmer,
  DirectoryRestaurant,
  MarketSnapshot,
  MarketZone,
} from "./types";

// Lecture des données de la place de marché pour un compte : chacun ne
// reçoit que ce qui le concerne (voir `scope`).

export const PAYMENT_METHOD_DB: Record<
  PaymentMethod,
  "wave" | "orange_money" | "free_money" | "cash"
> = {
  Wave: "wave",
  "Orange Money": "orange_money",
  "Free Money": "free_money",
  Espèces: "cash",
};
const PAYMENT_METHOD_LABEL: Record<string, PaymentMethod> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  cash: "Espèces",
  transfer: "Wave",
};

const VEHICLE_LABEL: Record<string, Mission["vehicleType"]> = {
  velo: "Moto",
  moto: "Moto",
  tricycle: "Tricycle",
  camionnette: "Camionnette",
  camion: "Camion",
};

// Photo par défaut d'un produit sans photo : celle d'un produit de démo de la
// même catégorie (le catalogue reste lisible avant les vraies photos).
const CATEGORY_IMAGE: Record<string, string> = Object.fromEntries(
  demoProducts.map((p) => [p.category, p.image]),
);
const DEFAULT_IMAGE = demoProducts[0]?.image ?? "";

export function avatarFor(name: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "?")}`;
}

function phoneLabel(phone: string | null | undefined) {
  return phone ? `+221 ${formatSenegalPhone(phone)}` : "";
}

function iso(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined;
  return (d instanceof Date ? d : new Date(d)).toISOString();
}

// Liens signés des preuves : gardés quelques minutes pour ne pas en
// redemander à chaque rafraîchissement.
const signedCache = new Map<string, { url: string; until: number }>();
async function cachedSignedUrl(storageKeyValue: string): Promise<string | undefined> {
  const hit = signedCache.get(storageKeyValue);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = await signedUrl(storageKeyValue);
  if (!url) return undefined;
  signedCache.set(storageKeyValue, { url, until: Date.now() + 10 * 60_000 });
  if (signedCache.size > 2000) signedCache.clear();
  return url;
}

export type MarketRules = Omit<MarketSnapshot["rules"], "merchant"> & {
  receptionWindowHours: number;
};

export async function readRules(db: Db): Promise<MarketRules> {
  const rows = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        "cutoff_hour",
        "min_order_per_producer",
        "payment_methods",
        "reception_window_hours",
      ]),
    );
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  const pm = v.payment_methods as
    | {
        wave?: { enabled?: boolean };
        orangeMoney?: { enabled?: boolean };
        cashOnDelivery?: { enabled?: boolean };
      }
    | undefined;
  const paymentMethods: PaymentMethod[] = pm
    ? [
        ...(pm.wave?.enabled ? (["Wave"] as const) : []),
        ...(pm.orangeMoney?.enabled ? (["Orange Money"] as const) : []),
        ...(pm.cashOnDelivery?.enabled ? (["Espèces"] as const) : []),
      ]
    : // Pas encore réglé par l'admin : Free Money n'a pas de compte marchand.
      ["Wave", "Orange Money", "Espèces"];
  return {
    cutoffHour: num(v.cutoff_hour, 18),
    minOrderPerProducer: num(v.min_order_per_producer, 5000),
    receptionWindowHours: num(v.reception_window_hours, 48),
    paymentMethods,
  };
}

/** Zones livrées : chaque ville (frais de base) et ses quartiers. */
export async function readZones(db: Db): Promise<MarketZone[]> {
  const cityRows = await db.select().from(cities).orderBy(asc(cities.name));
  const zoneRows = await db.select().from(zones).orderBy(asc(zones.name));
  const out: MarketZone[] = [];
  for (const c of cityRows) {
    out.push({
      id: c.id,
      name: c.name,
      baseFee: c.baseFee ?? 0,
      perKm: c.perKmFee ?? 0,
      active: c.active,
    });
    for (const z of zoneRows.filter((x) => x.cityId === c.id)) {
      out.push({
        id: z.id,
        name: z.name,
        baseFee: z.deliveryFee ?? c.baseFee ?? 0,
        perKm: c.perKmFee ?? 0,
        active: c.active && z.active,
      });
    }
  }
  return out;
}

type Viewer = { id: string; role: Role };

export async function readSnapshot(db: Db, me: Viewer): Promise<MarketSnapshot> {
  const [rules, zoneList] = await Promise.all([readRules(db), readZones(db)]);
  // Ville de chaque quartier, pour situer producteurs et restaurants.
  const zoneCityRows = await db
    .select({ id: zones.id, city: cities.name })
    .from(zones)
    .innerJoin(cities, eq(cities.id, zones.cityId));
  const cityOfZone = new Map(zoneCityRows.map((z) => [z.id, z.city]));

  // --- Commandes visibles ---------------------------------------------------
  let orderWhere;
  if (me.role === "farmer") orderWhere = eq(orders.farmerId, me.id);
  else if (me.role === "restaurant") orderWhere = eq(orders.restaurantId, me.id);
  else if (me.role === "driver") {
    const visible = db
      .select({ id: missions.orderId })
      .from(missions)
      .where(or(eq(missions.status, "available"), eq(missions.driverId, me.id)));
    orderWhere = inArray(orders.id, visible);
  }
  const orderRows = await db
    .select()
    .from(orders)
    .where(orderWhere)
    .orderBy(desc(orders.createdAt))
    .limit(me.role === "admin" ? 500 : 300);
  const orderIds = orderRows.map((o) => o.id);
  const checkoutIds = [...new Set(orderRows.map((o) => o.checkoutId))];

  const [itemRows, eventRows, checkoutRows, paymentRows, missionRows] = await Promise.all([
    orderIds.length
      ? db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [],
    orderIds.length
      ? db
          .select()
          .from(orderEvents)
          .where(inArray(orderEvents.orderId, orderIds))
          .orderBy(asc(orderEvents.at))
      : [],
    checkoutIds.length ? db.select().from(checkouts).where(inArray(checkouts.id, checkoutIds)) : [],
    checkoutIds.length
      ? db
          .select()
          .from(payments)
          .where(inArray(payments.checkoutId, checkoutIds))
          .orderBy(desc(payments.createdAt))
      : [],
    orderIds.length ? db.select().from(missions).where(inArray(missions.orderId, orderIds)) : [],
  ]);
  const refundRows =
    orderIds.length && (me.role === "restaurant" || me.role === "admin")
      ? await db
          .select()
          .from(refunds)
          .where(inArray(refunds.orderId, orderIds))
          .orderBy(desc(refunds.createdAt))
      : [];
  const missionIds = missionRows.map((m) => m.id);
  const [missionEventRows, proofRows] = await Promise.all([
    missionIds.length
      ? db
          .select()
          .from(missionEvents)
          .where(inArray(missionEvents.missionId, missionIds))
          .orderBy(asc(missionEvents.at))
      : [],
    missionIds.length
      ? db
          .select({
            id: deliveryProofs.id,
            missionId: deliveryProofs.missionId,
            stage: deliveryProofs.stage,
            takenAt: deliveryProofs.takenAt,
            storageKey: files.storageKey,
            mime: files.mime,
            size: files.sizeBytes,
          })
          .from(deliveryProofs)
          .innerJoin(files, eq(files.id, deliveryProofs.fileId))
          .where(inArray(deliveryProofs.missionId, missionIds))
      : [],
  ]);

  // --- Annuaire --------------------------------------------------------------
  const farmerIds = new Set(orderRows.map((o) => o.farmerId));
  const restaurantIds = new Set(orderRows.map((o) => o.restaurantId));
  const driverIds = new Set(missionRows.flatMap((m) => (m.driverId ? [m.driverId] : [])));
  if (me.role === "farmer") farmerIds.add(me.id);
  if (me.role === "restaurant") restaurantIds.add(me.id);
  if (me.role === "driver") driverIds.add(me.id);

  // Restaurants et admin voient tous les producteurs actifs (catalogue).
  const allFarmers = me.role === "restaurant" || me.role === "admin";
  const farmerRows = await db
    .select({
      id: farmers.userId,
      farmName: farmers.farmName,
      pickupAddress: farmers.pickupAddress,
      zoneId: farmers.zoneId,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      status: users.status,
    })
    .from(farmers)
    .innerJoin(users, eq(users.id, farmers.userId))
    .where(
      allFarmers
        ? eq(users.status, "active")
        : farmerIds.size
          ? inArray(farmers.userId, [...farmerIds])
          : sql`false`,
    );
  const restaurantRows = await db
    .select({
      id: restaurants.userId,
      name: restaurants.name,
      cuisine: restaurants.cuisine,
      address: restaurants.address,
      zoneId: restaurants.zoneId,
      phone: users.phone,
    })
    .from(restaurants)
    .innerJoin(users, eq(users.id, restaurants.userId))
    .where(
      me.role === "admin"
        ? sql`true`
        : restaurantIds.size
          ? inArray(restaurants.userId, [...restaurantIds])
          : sql`false`,
    );
  const driverRows = await db
    .select({
      id: drivers.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
    })
    .from(drivers)
    .innerJoin(users, eq(users.id, drivers.userId))
    .where(
      me.role === "admin"
        ? sql`true`
        : driverIds.size
          ? inArray(drivers.userId, [...driverIds])
          : sql`false`,
    );
  const vehicleRows = driverRows.length
    ? await db
        .select()
        .from(vehicles)
        .where(
          and(
            inArray(
              vehicles.driverId,
              driverRows.map((d) => d.id),
            ),
            eq(vehicles.status, "active"),
          ),
        )
    : [];
  const deliveredCount = driverRows.length
    ? await db
        .select({ driverId: missions.driverId, n: sql<number>`count(*)::int` })
        .from(missions)
        .where(
          and(
            inArray(
              missions.driverId,
              driverRows.map((d) => d.id),
            ),
            eq(missions.status, "delivered"),
          ),
        )
        .groupBy(missions.driverId)
    : [];

  const cityName = (zoneId: string | null, address: string) =>
    (zoneId && cityOfZone.get(zoneId)) || lastAddressSegment(address);

  // --- Produits ---------------------------------------------------------------
  let productWhere;
  if (me.role === "farmer") productWhere = eq(products.farmerId, me.id);
  else if (me.role === "restaurant") {
    productWhere = and(
      ne(products.status, "draft"),
      inArray(
        products.farmerId,
        farmerRows.map((f) => f.id),
      ),
    );
  } else if (me.role === "driver") {
    const ids = [...new Set(itemRows.map((i) => i.productId))];
    productWhere = ids.length ? inArray(products.id, ids) : sql`false`;
  }
  const productRows = await db
    .select({
      p: products,
      category: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(productWhere)
    .orderBy(desc(products.createdAt));
  const productIds = productRows.map((r) => r.p.id);
  const photoRows = productIds.length
    ? await db
        .select({
          productId: productPhotos.productId,
          position: productPhotos.position,
          storageKey: files.storageKey,
        })
        .from(productPhotos)
        .innerJoin(files, eq(files.id, productPhotos.fileId))
        .where(inArray(productPhotos.productId, productIds))
        .orderBy(asc(productPhotos.position))
    : [];
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthly = productIds.length
    ? await db
        .select({ productId: orderItems.productId, n: sql<number>`count(*)::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(
          and(
            inArray(orderItems.productId, productIds),
            gte(orders.createdAt, monthStart),
            ne(orders.status, "cancelled"),
          ),
        )
        .groupBy(orderItems.productId)
    : [];
  const monthlyBy = new Map(monthly.map((m) => [m.productId, m.n]));
  const farmerById = new Map(farmerRows.map((f) => [f.id, f]));

  const productList: Product[] = productRows.map(({ p, category }) => {
    const photos = photoRows
      .filter((ph) => ph.productId === p.id)
      .map((ph) => publicUrl(ph.storageKey))
      .filter((u): u is string => !!u);
    const stock = Number(p.stockQty);
    const minStock = Number(p.minStock);
    return {
      id: p.id,
      name: p.name,
      category: category as Product["category"],
      pricePerKg: p.price,
      unit: p.unit,
      stock,
      minStock,
      sku: `SKU-${p.id.slice(0, 6).toUpperCase()}`,
      image: photos[0] ?? CATEGORY_IMAGE[category] ?? DEFAULT_IMAGE,
      status:
        p.status === "draft" ? "draft" : stock <= 0 ? "out" : stock < minStock ? "low" : "active",
      ordersThisMonth: monthlyBy.get(p.id) ?? 0,
      farmerId: p.farmerId,
      description: p.description ?? undefined,
      minOrder: p.minOrderQty != null ? Number(p.minOrderQty) : undefined,
      availableFrom: p.availableFrom ?? undefined,
      organic: p.organic,
      photos: photos.length ? photos : undefined,
      pickupAddress: farmerById.get(p.farmerId)?.pickupAddress,
      paused: p.status === "paused",
    };
  });

  // --- Commandes : formes producteur et restaurant ------------------------------
  const checkoutById = new Map(checkoutRows.map((c) => [c.id, c]));
  // Paiements triés du plus récent au plus ancien : on garde le dernier du
  // panier (Wave / OM) et celui de chaque commande (espèces).
  const paymentByCheckout = new Map<string, (typeof paymentRows)[number]>();
  const cashPaymentByOrder = new Map<string, (typeof paymentRows)[number]>();
  for (const p of paymentRows) {
    if (p.orderId) {
      if (!cashPaymentByOrder.has(p.orderId)) cashPaymentByOrder.set(p.orderId, p);
    } else if (!paymentByCheckout.has(p.checkoutId)) paymentByCheckout.set(p.checkoutId, p);
  }
  const ordersByCheckout = new Map<string, (typeof orderRows)[number][]>();
  for (const o of orderRows) {
    ordersByCheckout.set(o.checkoutId, [...(ordersByCheckout.get(o.checkoutId) ?? []), o]);
  }
  const paymentFor = (o: (typeof orderRows)[number]) =>
    checkoutById.get(o.checkoutId)?.paymentMode === "prepaid"
      ? paymentByCheckout.get(o.checkoutId)
      : cashPaymentByOrder.get(o.id);
  const paymentView = (
    p: (typeof paymentRows)[number],
    c: (typeof checkoutRows)[number],
  ): OrderPayment => {
    const covered = (ordersByCheckout.get(c.id) ?? []).filter((x) =>
      p.orderId ? x.id === p.orderId : x.status !== "cancelled",
    );
    return {
      id: p.id,
      checkoutId: c.id,
      checkoutReference: c.reference,
      mode: p.orderId ? "cash" : "prepaid",
      state: paymentState(p),
      method: PAYMENT_METHOD_LABEL[p.method] ?? "Wave",
      amount: p.amount,
      orderReferences: covered.map((x) => x.reference),
      providerRef: p.providerRef ?? undefined,
      note: p.note ?? undefined,
      declaredAt: iso(p.declaredAt),
      collectedAt: iso(p.collectedAt),
      paidAt: iso(p.paidAt),
    };
  };
  const refundsByOrder = new Map<string, RefundView[]>();
  for (const r of refundRows) {
    const o = orderRows.find((x) => x.id === r.orderId);
    refundsByOrder.set(r.orderId, [
      ...(refundsByOrder.get(r.orderId) ?? []),
      {
        id: r.id,
        reference: r.reference,
        orderId: r.orderId,
        orderReference: o?.reference ?? "",
        source: r.source,
        amount: r.amount,
        status: r.status,
        reason: r.reason ?? undefined,
        createdAt: iso(r.createdAt)!,
        paidAt: iso(r.paidAt),
        providerRef: r.providerRef ?? undefined,
      },
    ]);
  }
  const missionByOrder = new Map(
    missionRows
      .filter((m) => m.status !== "cancelled")
      .concat(missionRows.filter((m) => m.status === "cancelled"))
      .reverse()
      .map((m) => [m.orderId, m]),
  );
  const seeCodes = (o: (typeof orderRows)[number], who: "farmer" | "restaurant") =>
    me.role === "admin" ||
    (who === "farmer" && me.role === "farmer" && o.farmerId === me.id) ||
    (who === "restaurant" && me.role === "restaurant" && o.restaurantId === me.id);

  const orderList: Order[] = [];
  const restaurantOrderList: RestaurantOrder[] = [];
  for (const o of orderRows) {
    const c = checkoutById.get(o.checkoutId);
    const lines = itemRows.filter((i) => i.orderId === o.id);
    const items = lines.map((i) => ({
      productId: i.productId,
      qty: Number(i.qtyConfirmed ?? i.qtyOrdered),
      price: i.unitPrice,
    }));
    const events = eventRows.filter((e) => e.orderId === o.id);
    const mission = missionByOrder.get(o.id);
    const createdAt = iso(o.createdAt)!;
    if (me.role !== "restaurant") {
      orderList.push({
        id: o.id,
        reference: o.reference,
        restaurantId: o.restaurantId,
        farmerId: o.farmerId,
        driverId: mission?.driverId ?? undefined,
        items,
        total: o.subtotal,
        status: o.status,
        createdAt,
        eta: c?.slotLabel ?? undefined,
        deliveryAddress: c?.deliveryAddress,
        stockReserved: true,
        deliveredAt: iso(o.deliveredAt),
        pickupCode: seeCodes(o, "farmer") ? o.pickupCode : undefined,
        awaitingPayment:
          c?.paymentMode === "prepaid" &&
          paymentByCheckout.get(c.id)?.status !== "confirmed" &&
          (o.status === "pending" || o.status === "confirmed"),
      });
    }
    if (me.role === "restaurant" || me.role === "admin") {
      const pay = paymentFor(o);
      const payment = pay && c ? paymentView(pay, c) : undefined;
      const refused = lines.filter((i) => Number(i.qtyRefused) > 0);
      restaurantOrderList.push({
        id: o.id,
        reference: o.reference,
        farmerId: o.farmerId,
        items,
        total: Math.max(0, o.subtotal + o.deliveryFee - o.discount),
        status: o.status,
        createdAt,
        eta: c?.slotLabel ?? undefined,
        deliveryAddress: c?.deliveryAddress ?? "",
        paymentMethod: PAYMENT_METHOD_LABEL[pay?.method ?? "wave"] ?? "Wave",
        statusHistory: events.map((e) => ({ status: e.status, at: iso(e.at)! })),
        paid: payment?.state === "paid" || payment?.state === "collected",
        paidAt: payment?.paidAt ?? payment?.collectedAt,
        payment,
        refunds: refundsByOrder.get(o.id),
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        promoDiscount: o.discount || undefined,
        shortagePreference: o.shortagePreference,
        instructions: c?.instructions ?? undefined,
        slotStart: iso(c?.slotStart),
        cancelReason: o.cancelReason ?? undefined,
        deliveryCode: seeCodes(o, "restaurant") ? o.deliveryCode : undefined,
        deliveredWithCode: o.deliveredWithCode,
        trackingToken: o.trackingToken,
        reception: o.receptionAt
          ? {
              at: iso(o.receptionAt)!,
              lines: refused.map((i) => ({
                productId: i.productId,
                refusedQty: Number(i.qtyRefused),
                reason: i.refusalReason ?? "",
              })),
              refundedAmount: refused.reduce((s, i) => s + Number(i.qtyRefused) * i.unitPrice, 0),
              note: o.receptionNote ?? undefined,
            }
          : undefined,
      });
    }
  }

  // --- Missions -----------------------------------------------------------------
  const restaurantById = new Map(restaurantRows.map((r) => [r.id, r]));
  const orderById = new Map(orderRows.map((o) => [o.id, o]));
  const visibleMissions = missionRows.filter((m) => {
    if (me.role !== "driver") return true;
    return m.status === "available" || m.driverId === me.id;
  });
  const missionList: Mission[] = [];
  for (const m of visibleMissions) {
    const o = orderById.get(m.orderId);
    if (!o) continue;
    const c = checkoutById.get(o.checkoutId);
    const f = farmerById.get(o.farmerId);
    const r = restaurantById.get(o.restaurantId);
    const pickupCity = f ? cityName(f.zoneId, f.pickupAddress) : "";
    const dropoffAddress = c?.deliveryAddress ?? r?.address ?? "";
    const dropoffCity = lastAddressSegment(dropoffAddress);
    const pickupCoords = cityCoords(pickupCity || "Dakar");
    const dropoffCoords = cityCoords(dropoffCity || "Dakar");
    const weightKg = Number(m.weightKg ?? 0);
    const events = missionEventRows.filter((e) => e.missionId === m.id);
    const history = events
      .filter((e): e is typeof e & { status: MissionStatus } => e.status !== null)
      .map((e) => ({ status: e.status, at: iso(e.at)!, ...(e.note ? { note: e.note } : {}) }));
    const endOf = (s: MissionStatus) => history.find((h) => h.status === s)?.at;
    const waits = events
      .filter((e) => e.status === null && e.note?.startsWith("arrivee:"))
      .map((e) => {
        const stage = e.note === "arrivee:pickup" ? ("pickup" as const) : ("dropoff" as const);
        return {
          stage,
          arrivedAt: iso(e.at)!,
          endedAt: endOf(stage === "pickup" ? "loaded" : "delivered"),
        };
      });
    const mine =
      me.role === "admin" ||
      (me.role === "driver" && m.driverId === me.id) ||
      (me.role === "farmer" && o.farmerId === me.id) ||
      (me.role === "restaurant" && o.restaurantId === me.id);
    const proofs = mine ? proofRows.filter((p) => p.missionId === m.id) : [];
    const proof = await Promise.all(
      proofs.map(async (p) => ({
        id: p.id,
        name: isStored(p.storageKey)
          ? `preuve-${p.stage === "pickup" ? "enlevement" : "livraison"}`
          : "Photo non conservée (démonstration sans stockage)",
        size: p.size,
        mime: p.mime,
        dataUrl: await cachedSignedUrl(p.storageKey),
        at: iso(p.takenAt)!,
      })),
    );
    const { estimatedMinutes } = routeEstimate(pickupCity || "Dakar", dropoffCity || "Dakar");
    missionList.push({
      id: m.id,
      reference: m.reference,
      orderRef: o.reference,
      farmerId: o.farmerId,
      restaurantId: o.restaurantId,
      driverId: m.driverId ?? undefined,
      status: m.status,
      pickup: {
        address: f ? `${f.farmName}, ${f.pickupAddress}` : "",
        city: pickupCity,
        ...pickupCoords,
        contactPhone: phoneLabel(f?.phone),
      },
      dropoff: {
        address: dropoffAddress,
        city: dropoffCity,
        ...dropoffCoords,
        contactPhone: phoneLabel(r?.phone),
      },
      distanceKm: Number(m.distanceKm ?? 0),
      estimatedMinutes,
      payout: m.payout,
      weightKg,
      itemsCount: itemRows.filter((i) => i.orderId === o.id).length,
      scheduledFor: iso(m.scheduledFor)!,
      createdAt: iso(m.createdAt)!,
      vehicleType: vehicleForWeight(weightKg),
      urgency: m.urgency,
      proof: proof.length ? proof : undefined,
      statusHistory: history,
      waits: waits.length ? waits : undefined,
      instructions: c?.instructions ?? undefined,
      cashToCollect: (() => {
        const cash = c?.paymentMode === "prepaid" ? undefined : cashPaymentByOrder.get(o.id);
        return cash && cash.status === "pending" && !cash.collectedAt ? orderDue(o) : undefined;
      })(),
    });
  }

  // --- Annuaire (forme des données de démo) --------------------------------------
  const listedCount = new Map<string, number>();
  for (const p of productList) {
    if (p.status !== "draft" && !p.paused) {
      listedCount.set(p.farmerId, (listedCount.get(p.farmerId) ?? 0) + 1);
    }
  }
  const directoryFarmers: DirectoryFarmer[] = farmerRows.map((f) => {
    const name = `${f.firstName} ${f.lastName}`.trim();
    return {
      id: f.id,
      name,
      city: cityName(f.zoneId, f.pickupAddress),
      farm: f.farmName,
      phone: phoneLabel(f.phone),
      avatar: avatarFor(name),
      rating: 0,
      products: listedCount.get(f.id) ?? 0,
      verified: f.status === "active",
    };
  });
  const directoryRestaurants: DirectoryRestaurant[] = restaurantRows.map((r) => ({
    id: r.id,
    name: r.name,
    city: cityName(r.zoneId, r.address),
    type: r.cuisine ?? "Restaurant",
    phone: phoneLabel(r.phone),
    avatar: avatarFor(r.name),
  }));
  const deliveredBy = new Map(deliveredCount.map((d) => [d.driverId, d.n]));
  const directoryDrivers: DirectoryDriver[] = driverRows.map((d) => {
    const name = `${d.firstName} ${d.lastName}`.trim();
    const v = vehicleRows
      .filter((x) => x.driverId === d.id)
      .sort((a, b) => b.capacityKg - a.capacityKg)[0];
    return {
      id: d.id,
      name,
      vehicle: v ? (VEHICLE_LABEL[v.type] ?? "Moto") : "Moto",
      rating: 0,
      missions: deliveredBy.get(d.id) ?? 0,
      phone: phoneLabel(d.phone),
      avatar: avatarFor(name),
    };
  });

  // --- Paiements (admin) ------------------------------------------------------------
  let adminPayments: AdminPayment[] | undefined;
  if (me.role === "admin") {
    const confirmerIds = [
      ...new Set(paymentRows.flatMap((p) => (p.confirmedBy ? [p.confirmedBy] : []))),
    ];
    const confirmers = confirmerIds.length
      ? await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(inArray(users.id, confirmerIds))
      : [];
    const personName = (x?: { firstName: string; lastName: string }) =>
      x ? `${x.firstName} ${x.lastName}`.trim() : "";
    adminPayments = [...paymentByCheckout.values(), ...cashPaymentByOrder.values()].flatMap((p) => {
      const c = checkoutById.get(p.checkoutId);
      if (!c) return [];
      const covered = (ordersByCheckout.get(c.id) ?? []).filter(
        (o) => !p.orderId || o.id === p.orderId,
      );
      const r = restaurantRows.find((x) => x.id === c.restaurantId);
      const collector = p.collectedBy ? driverRows.find((d) => d.id === p.collectedBy) : null;
      return [
        {
          ...paymentView(p, c),
          restaurantId: c.restaurantId,
          restaurantName: r?.name ?? "Restaurant",
          restaurantPhone: phoneLabel(r?.phone),
          dueNow: covered.reduce((sum, o) => sum + orderDue(o), 0),
          orders: covered.map((o) => {
            const f = farmerById.get(o.farmerId);
            return {
              id: o.id,
              reference: o.reference,
              farmerName: f ? `${f.firstName} ${f.lastName}`.trim() : "Producteur",
              status: o.status,
              due: orderDue(o),
            };
          }),
          collectedBy: collector ? { id: collector.id, name: personName(collector) } : undefined,
          confirmedByName: personName(confirmers.find((x) => x.id === p.confirmedBy)) || undefined,
          createdAt: iso(p.createdAt)!,
        },
      ];
    });
  }
  const merchant =
    me.role === "restaurant" || me.role === "admin" ? await readMerchantAccounts(db) : null;

  // --- Établissement du restaurant connecté ----------------------------------------
  const myRestaurant =
    me.role === "restaurant" ? (restaurantRows.find((r) => r.id === me.id) ?? null) : null;

  // --- Notifications ------------------------------------------------------------
  const notifRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(60);
  const notificationList: AppNotification[] = notifRows.map((n) => ({
    id: n.id,
    type: (["order", "payment", "stock", "system", "message"].includes(n.type)
      ? n.type
      : "system") as AppNotification["type"],
    title: n.title,
    body: n.body ?? "",
    at: iso(n.createdAt)!,
    read: !!n.readAt,
    link: n.link ?? undefined,
  }));

  return {
    me,
    products: productList,
    orders: orderList,
    restaurantOrders: restaurantOrderList,
    missions: missionList,
    directory: {
      farmers: directoryFarmers,
      restaurants: directoryRestaurants,
      drivers: directoryDrivers,
    },
    zones: zoneList,
    rules: {
      cutoffHour: rules.cutoffHour,
      minOrderPerProducer: rules.minOrderPerProducer,
      paymentMethods: rules.paymentMethods,
      merchant: merchant ? { wave: merchant.wave, orangeMoney: merchant.orangeMoney } : null,
    },
    payments: adminPayments,
    restaurant: myRestaurant
      ? {
          name: myRestaurant.name,
          address: myRestaurant.address,
          city: cityName(myRestaurant.zoneId, myRestaurant.address),
        }
      : null,
    notifications: notificationList,
    generatedAt: new Date().toISOString(),
  };
}
