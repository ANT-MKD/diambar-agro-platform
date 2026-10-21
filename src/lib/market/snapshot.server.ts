import { and, asc, desc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { readCategories, readUnits } from "./catalog-db.server";
import { readRecurringOrders } from "./recurring-read.server";
import { readDisputes } from "./disputes-read.server";
import { disputeStaff } from "./disputes-db.server";
import { readCreditNotes } from "./credit-notes-db.server";
import { readConversations } from "./messaging-db.server";
import { readTickets } from "./support-db.server";
import { readReviews } from "./reviews-db.server";
import { readReturns } from "./returns-db.server";
import { readIncidents } from "./incidents-db.server";
import { MODERATION_PERMISSION, readModeration } from "./moderation-db.server";
import { hasPermission, permissionsOf } from "./market-common.server";
import { readMaintenance } from "@/lib/platform/params";
import type { CommissionTierSetting } from "@/lib/platform/setup-model";
import { DEFAULT_SETTINGS } from "@/db/seed";
import { readDriverFleet, readFleetQueue } from "./fleet-db.server";
import { readRestaurantBook } from "./restaurant-book-db.server";
import { readTeam } from "./team-db.server";
import { loadPeople } from "./people.server";
import { TEAM_ROLES, teamRoleLabel, type TeamCap, type TeamOwnerRole } from "./team";
import {
  categories,
  checkouts,
  cities,
  deliveryProofs,
  drivers,
  farmers,
  files,
  invoices,
  ledgerEntries,
  missionEvents,
  missions,
  notifications,
  orderEvents,
  orderItems,
  orders,
  payments,
  payouts,
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
  type DriverTx,
  type DriverWallet,
  type Mission,
  type MissionStatus,
  type Order,
  type PaymentMethod,
  type Product,
  type RestaurantOrder,
  type Role,
  type Transaction,
  type Withdrawal,
} from "@/data/mocks";
import { formatSenegalPhone } from "@/lib/auth/helpers";
import { lastAddressSegment, routeEstimate, vehicleForWeight } from "@/lib/mission-pay";
import { DEFAULT_RULES, normalizeDeliveryHours, normalizeDriverPay } from "@/lib/platform-rules";
import { cityCoords } from "@/lib/tracking/geo";
import {
  paymentState,
  type AdminPayment,
  type AdminPayout,
  type AdminRefund,
  type OrderPayment,
  type RefundView,
} from "./payment-view";
import { orderDue, readMerchantAccounts } from "./payments-db.server";
import { farmerOrigin, readPlaces } from "./delivery-db.server";
import { ACTIVE_MISSION_STATUSES, readDriverPositions } from "./positions-db.server";
import { readBalances } from "./ledger-db.server";
import type { InvoiceContent, InvoiceView } from "./documents-view";
import { paymentDeadline } from "@/lib/payment-deadline";
import { isStored, publicUrl, signedUrl } from "./storage.server";
import type {
  AdminAccount,
  DirectoryDriver,
  DirectoryFarmer,
  DirectoryRestaurant,
  MarketAccount,
  MarketSnapshot,
  MarketZone,
  ReceptionHoursSetting,
} from "./types";
import { readPreferences } from "./profile-db.server";

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
export const PAYMENT_METHOD_LABEL: Record<string, PaymentMethod> = {
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

/** Photo de profil envoyée par la personne (stockage public). */
function avatarUrlOf(key: string | null | undefined): string | null {
  return key ? publicUrl(key) : null;
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

export type MarketRules = Omit<MarketSnapshot["rules"], "merchant" | "cities">;

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
        "payment_deadline_hour",
        "min_payout",
        "delivery_hours",
        "driver_pay",
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
    paymentDeadlineHour: num(v.payment_deadline_hour, 20),
    minPayout: num(v.min_payout, DEFAULT_RULES.minPayout),
    deliveryHours: normalizeDeliveryHours(v.delivery_hours),
    driverPay: normalizeDriverPay(v.driver_pay),
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

type FarmerLedgerRow = {
  id: string;
  kind: string;
  amount: number;
  orderId: string | null;
  refundId: string | null;
  note: string | null;
  createdAt: Date;
  orderRef: string | null;
  restaurantId: string | null;
  checkoutId: string | null;
};

/** Écritures d'un ou plusieurs producteurs (les plus récentes d'abord) en
 * lignes de revenus : une par commande livrée (vente − commission), une par
 * remboursement repris et une par ajustement de litige. */
function farmerTransactions<R extends FarmerLedgerRow>(
  entries: R[],
  methodOfCheckout: Map<string, PaymentMethod>,
  farmerOf: (e: R) => string,
): Transaction[] {
  const groups = new Map<string, Transaction>();
  for (const e of [...entries].reverse()) {
    // Indemnité ou retenue de litige : une ligne à part, avec son motif.
    const disputeLine = !!e.note && /Litige /.test(e.note);
    if (
      !e.orderId ||
      (e.kind !== "sale" &&
        e.kind !== "commission" &&
        e.kind !== "refund_adjustment" &&
        !(e.kind === "adjustment" && disputeLine))
    )
      continue;
    const key = disputeLine ? `lt_${e.id}` : e.refundId ? `rf_${e.refundId}` : `tx_${e.orderId}`;
    const t =
      groups.get(key) ??
      ({
        id: key,
        date: iso(e.createdAt)!.slice(0, 10),
        orderRef: e.orderRef ?? "",
        restaurantId: e.restaurantId ?? "",
        farmerId: farmerOf(e),
        gross: 0,
        commission: 0,
        net: 0,
        method: (e.checkoutId && methodOfCheckout.get(e.checkoutId)) || "Wave",
        status: "Payé",
        kind: e.refundId || disputeLine ? "refund_adjustment" : "delivery",
        ...(disputeLine ? { note: e.note ?? undefined } : {}),
      } satisfies Transaction);
    if (e.kind === "commission") t.commission += -e.amount;
    else t.gross += e.amount;
    t.net = t.gross - t.commission;
    groups.set(key, t);
  }
  return [...groups.values()].reverse();
}

/** Maintenance (tous les portails) et barème de commissions (admin, producteur). */
async function platformParamsPart(
  db: Db,
  role: string,
): Promise<Pick<MarketSnapshot, "maintenance" | "commissionTiers">> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, ["maintenance", "commission_tiers"]));
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  const tiers = value("commission_tiers") as CommissionTierSetting[] | undefined;
  return {
    maintenance: readMaintenance(value("maintenance")),
    ...(role === "admin" || role === "farmer"
      ? {
          commissionTiers: tiers ?? (DEFAULT_SETTINGS.commission_tiers as CommissionTierSetting[]),
        }
      : {}),
  };
}

export async function readSnapshot(
  db: Db,
  me: Viewer,
  member: { userId: string; name: string; role: string } | null = null,
): Promise<MarketSnapshot> {
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
      lat: farmers.lat,
      lng: farmers.lng,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      status: users.status,
      avatarKey: users.avatarKey,
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
      avatarKey: users.avatarKey,
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
      avatarKey: users.avatarKey,
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
    const state = paymentState(p);
    return {
      id: p.id,
      checkoutId: c.id,
      checkoutReference: c.reference,
      mode: p.orderId ? "cash" : "prepaid",
      state,
      dueBy:
        state === "to_pay" || state === "refused"
          ? paymentDeadline(c.createdAt, c.slotStart, rules.paymentDeadlineHour).toISOString()
          : undefined,
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
        // Panier réglé entièrement par un avoir : rien à payer.
        paid:
          c?.paymentMode === "credit" ||
          payment?.state === "paid" ||
          payment?.state === "collected",
        paidAt: c?.paymentMode === "credit" ? createdAt : (payment?.paidAt ?? payment?.collectedAt),
        payment,
        refunds: refundsByOrder.get(o.id),
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        // Les remises en base viennent des avoirs.
        creditApplied: o.discount || undefined,
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
  // Positions réelles des lieux (réglées dans Tarifs de livraison) et des
  // livreurs en course.
  const places = visibleMissions.length ? await readPlaces(db) : null;
  const positions = await readDriverPositions(db, [
    ...new Set(
      visibleMissions.flatMap((m) =>
        m.driverId && (ACTIVE_MISSION_STATUSES as readonly string[]).includes(m.status)
          ? [m.driverId]
          : [],
      ),
    ),
  ]);
  for (const m of visibleMissions) {
    const o = orderById.get(m.orderId);
    if (!o) continue;
    const c = checkoutById.get(o.checkoutId);
    const f = farmerById.get(o.farmerId);
    const r = restaurantById.get(o.restaurantId);
    const pickupCity = f ? cityName(f.zoneId, f.pickupAddress) : "";
    const dropoffAddress = c?.deliveryAddress ?? r?.address ?? "";
    const dropoffCity = lastAddressSegment(dropoffAddress);
    const origin = f && places ? farmerOrigin(f, places) : null;
    const destination = c?.zoneId && places ? places.byId.get(c.zoneId) : null;
    const pickupCoords = origin
      ? { lat: origin.lat, lng: origin.lng }
      : cityCoords(pickupCity || "Dakar");
    const dropoffCoords = destination
      ? { lat: destination.lat, lng: destination.lng }
      : cityCoords(dropoffCity || "Dakar");
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
      vehicleType: vehicleForWeight(weightKg, rules.driverPay),
      urgency: m.urgency,
      proof: proof.length ? proof : undefined,
      statusHistory: history,
      waits: waits.length ? waits : undefined,
      instructions: c?.instructions ?? undefined,
      cashToCollect: (() => {
        const cash = c?.paymentMode === "prepaid" ? undefined : cashPaymentByOrder.get(o.id);
        return cash && cash.status === "pending" && !cash.collectedAt ? orderDue(o) : undefined;
      })(),
      driverPosition: (() => {
        // Seulement pour une course en cours : pas pour une course terminée
        // du même livreur.
        const active = (ACTIVE_MISSION_STATUSES as readonly string[]).includes(m.status);
        const pos = active && m.driverId ? positions.get(m.driverId) : undefined;
        if (!pos) return undefined;
        // Le restaurant ne la voit que pendant la livraison, si le livreur
        // partage sa position (Paramètres › Confidentialité).
        const allowed =
          me.role === "admin" ||
          (me.role === "driver" && m.driverId === me.id) ||
          (me.role === "restaurant" &&
            o.restaurantId === me.id &&
            m.status === "loaded" &&
            pos.sharing);
        if (!allowed) return undefined;
        const { sharing: _sharing, ...shown } = pos;
        return shown;
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
      avatar: avatarUrlOf(f.avatarKey) ?? avatarFor(name),
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
    avatar: avatarUrlOf(r.avatarKey) ?? avatarFor(r.name),
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
      avatar: avatarUrlOf(d.avatarKey) ?? avatarFor(name),
    };
  });

  // --- Comptes : revenus du producteur, portefeuille du livreur ----------------------
  let farmerWallet: MarketSnapshot["wallet"];
  let driverWallet: DriverWallet | undefined;
  const PAYOUT_LABEL: Record<string, PaymentMethod> = {
    wave: "Wave",
    orange_money: "Orange Money",
    free_money: "Free Money",
    cash: "Espèces",
    transfer: "Wave",
  };
  const methodOfCheckout = new Map(
    checkoutRows.map((c) => [
      c.id,
      PAYMENT_METHOD_LABEL[
        paymentByCheckout.get(c.id)?.method ?? (c.paymentMode === "cash" ? "cash" : "wave")
      ] ?? "Wave",
    ]),
  );
  if (me.role === "farmer" || me.role === "driver") {
    const entries = await db
      .select({
        id: ledgerEntries.id,
        kind: ledgerEntries.kind,
        amount: ledgerEntries.amount,
        orderId: ledgerEntries.orderId,
        refundId: ledgerEntries.refundId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        orderRef: orders.reference,
        restaurantId: orders.restaurantId,
        checkoutId: orders.checkoutId,
        missionRef: missions.reference,
      })
      .from(ledgerEntries)
      .leftJoin(orders, eq(orders.id, ledgerEntries.orderId))
      .leftJoin(missions, eq(missions.id, ledgerEntries.missionId))
      .where(eq(ledgerEntries.userId, me.id))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(2000);
    const myPayouts = await db
      .select()
      .from(payouts)
      .where(eq(payouts.userId, me.id))
      .orderBy(desc(payouts.createdAt));
    const balances = await readBalances(db, [me.id]);
    const bal = balances.get(me.id)!;
    if (me.role === "farmer") {
      farmerWallet = {
        transactions: farmerTransactions(entries, methodOfCheckout, () => me.id),
        withdrawals: myPayouts.map((w): Withdrawal => ({
          id: w.id,
          farmerId: me.id,
          date: iso(w.createdAt)!.slice(0, 10),
          method: PAYOUT_LABEL[w.method] ?? "Wave",
          amount: w.amount,
          fee: w.fee,
          status:
            w.status === "paid"
              ? "Effectué"
              : w.status === "requested" || w.status === "processing"
                ? "En cours"
                : "Échec",
          reference: w.reference ?? w.id.slice(0, 8),
        })),
        balance: bal.balance,
        available: bal.available,
      };
    } else {
      const txs: DriverTx[] = entries
        .filter(
          (e) => e.kind === "driver_payout" || e.kind === "commission" || e.kind === "adjustment",
        )
        .map((e) => ({
          id: e.id,
          at: iso(e.createdAt)!,
          label:
            e.kind === "driver_payout"
              ? `Mission ${e.missionRef ?? ""}`.trim()
              : e.kind === "commission"
                ? "Commission plateforme (20 %)"
                : (e.note ?? "Ajustement"),
          ref: e.missionRef ?? e.orderRef ?? undefined,
          kind:
            e.kind === "driver_payout"
              ? "mission"
              : e.kind === "commission"
                ? "commission"
                : "adjustment",
          amount: e.amount,
          status: "Complété",
        }));
      for (const w of myPayouts) {
        txs.push({
          id: w.id,
          at: iso(w.createdAt)!,
          label: `Retrait ${PAYOUT_LABEL[w.method] ?? "Wave"}`,
          ref: w.reference ?? undefined,
          kind: "withdrawal",
          amount: -w.amount,
          method: PAYOUT_LABEL[w.method] ?? "Wave",
          status:
            w.status === "paid"
              ? "Complété"
              : w.status === "requested" || w.status === "processing"
                ? "En attente"
                : "Échec",
        });
      }
      txs.sort((a, b) => b.at.localeCompare(a.at));
      driverWallet = {
        cashHeld: bal.cashHeld,
        balance: bal.available,
        pending: bal.reserved,
        withdrawn: myPayouts
          .filter((w) => w.status === "paid")
          .reduce((sum, w) => sum + w.amount, 0),
        transactions: txs,
      };
    }
  }

  // Données d'argent de l'administration : seulement si le rôle les permet.
  const adminPerms = me.role === "admin" ? await permissionsOf(db, me.id) : [];
  const seesFinance = adminPerms.includes("finance.view");
  const seesRefunds = seesFinance || adminPerms.includes("refunds.view");

  // --- Revenus de tous les producteurs (page Finance de l'admin) -------------------
  let platformTransactions: Transaction[] | undefined;
  if (seesFinance) {
    const entries = await db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        kind: ledgerEntries.kind,
        amount: ledgerEntries.amount,
        orderId: ledgerEntries.orderId,
        refundId: ledgerEntries.refundId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        orderRef: orders.reference,
        restaurantId: orders.restaurantId,
        checkoutId: orders.checkoutId,
      })
      .from(ledgerEntries)
      .innerJoin(orders, eq(orders.id, ledgerEntries.orderId))
      .where(eq(ledgerEntries.account, "farmer"))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(5000);
    platformTransactions = farmerTransactions(entries, methodOfCheckout, (e) => e.userId ?? "");
  }

  // --- Comptes à verser (admin) ----------------------------------------------------
  let accounts: AdminAccount[] | undefined;
  if (seesFinance) {
    const holders = await db
      .selectDistinct({ userId: ledgerEntries.userId })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.userId} is not null`);
    const ids = holders.flatMap((h) => (h.userId ? [h.userId] : []));
    const balances = await readBalances(db, ids);
    const people = ids.length
      ? await db
          .select({
            id: users.id,
            role: users.role,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, ids))
      : [];
    accounts = people
      .filter((u) => u.role === "farmer" || u.role === "driver")
      .map((u) => ({
        userId: u.id,
        role: u.role as "farmer" | "driver",
        name: `${u.firstName} ${u.lastName}`.trim(),
        phone: phoneLabel(u.phone),
        ...balances.get(u.id)!,
      }))
      .sort((a, b) => b.balance - a.balance);
  }

  // --- Versements et remboursements (admin) --------------------------------------------
  let adminPayouts: AdminPayout[] | undefined;
  let adminRefunds: AdminRefund[] | undefined;
  if (seesRefunds) {
    const payoutRows = await db
      .select({
        p: payouts,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(payouts)
      .innerJoin(users, eq(users.id, payouts.userId))
      .orderBy(desc(payouts.createdAt))
      .limit(300);
    const owners = [...new Set(payoutRows.map((r) => r.p.userId))];
    const ownerBalances = await readBalances(db, owners);
    const { approvalThreshold } = await readMerchantAccounts(db);
    const twoAdmins = (amount: number) => approvalThreshold > 0 && amount >= approvalThreshold;
    const approverIds = [
      ...new Set([
        ...payoutRows.flatMap((r) => (r.p.approvedBy ? [r.p.approvedBy] : [])),
        ...refundRows.flatMap((r) => (r.approvedBy ? [r.approvedBy] : [])),
      ]),
    ];
    const approvers = approverIds.length
      ? await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(inArray(users.id, approverIds))
      : [];
    const approverName = (id: string | null) => {
      const a = approvers.find((x) => x.id === id);
      return a ? `${a.firstName} ${a.lastName}`.trim() : undefined;
    };
    adminPayouts = payoutRows.map(({ p, firstName, lastName, role }) => ({
      id: p.id,
      reference: p.reference ?? p.id.slice(0, 8),
      userId: p.userId,
      name: `${firstName} ${lastName}`.trim(),
      role: role === "driver" ? "driver" : "farmer",
      amount: p.amount,
      method: PAYMENT_METHOD_LABEL[p.method] ?? "Wave",
      accountNumber: phoneLabel(p.accountNumber),
      status: p.status,
      createdAt: iso(p.createdAt)!,
      paidAt: iso(p.paidAt),
      providerRef: p.providerRef ?? undefined,
      note: p.note ?? undefined,
      balance: ownerBalances.get(p.userId)?.balance ?? 0,
      needsTwoAdmins: twoAdmins(p.amount),
      approvedById: p.approvedBy ?? undefined,
      approvedByName: approverName(p.approvedBy),
    }));
    adminRefunds = refundRows.flatMap((r) => {
      const o = orderRows.find((x) => x.id === r.orderId);
      if (!o) return [];
      const c = checkoutById.get(o.checkoutId);
      const resto = restaurantRows.find((x) => x.id === o.restaurantId);
      const view = refundsByOrder.get(o.id)?.find((x) => x.id === r.id);
      if (!view) return [];
      return [
        {
          ...view,
          restaurantId: o.restaurantId,
          restaurantName: resto?.name ?? "Restaurant",
          restaurantPhone: phoneLabel(resto?.phone),
          checkoutReference: c?.reference ?? "",
          method: r.method ? (PAYMENT_METHOD_LABEL[r.method] ?? undefined) : undefined,
          paidTo: r.paidTo ? phoneLabel(r.paidTo) : undefined,
          bornBy: r.bornBy,
          needsTwoAdmins: twoAdmins(r.amount),
          approvedById: r.approvedBy ?? undefined,
          approvedByName: approverName(r.approvedBy),
        },
      ];
    });
  }

  // --- Paiements (admin) ------------------------------------------------------------
  let adminPayments: AdminPayment[] | undefined;
  if (seesFinance) {
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

  // --- Factures (restaurant, admin) --------------------------------------------------
  const invoiceList: InvoiceView[] | undefined =
    (me.role === "restaurant" || me.role === "admin") && checkoutIds.length
      ? (
          await db
            .select()
            .from(invoices)
            .where(inArray(invoices.checkoutId, checkoutIds))
            .orderBy(desc(invoices.issuedAt))
        ).flatMap((i) =>
          i.content
            ? [
                {
                  id: i.id,
                  number: i.number,
                  issuedAt: iso(i.issuedAt)!,
                  checkoutId: i.checkoutId,
                  checkoutReference: checkoutById.get(i.checkoutId)?.reference ?? "",
                  totalTtc: i.totalTtc,
                  content: i.content as InvoiceContent,
                },
              ]
            : [],
        )
      : undefined;

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
    type: (n.type === "offer"
      ? "order"
      : ["order", "payment", "stock", "system", "message"].includes(n.type)
        ? n.type
        : "system") as AppNotification["type"],
    title: n.title,
    body: n.body ?? "",
    at: iso(n.createdAt)!,
    read: !!n.readAt,
    link: n.link ?? undefined,
  }));

  // --- Compte connecté --------------------------------------------------------------
  const [meRow] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      createdAt: users.createdAt,
      city: cities.name,
      avatarKey: users.avatarKey,
      preferences: users.preferences,
    })
    .from(users)
    .leftJoin(cities, eq(cities.id, users.cityId))
    .where(eq(users.id, me.id));
  const account: MarketAccount = {
    firstName: meRow?.firstName ?? "",
    lastName: meRow?.lastName ?? "",
    email: meRow?.email ?? "",
    phone: meRow?.phone ?? "",
    city: meRow?.city ?? "",
    createdAt: iso(meRow?.createdAt) ?? new Date().toISOString(),
    avatarUrl: avatarUrlOf(meRow?.avatarKey) ?? "",
    preferences: readPreferences(meRow?.preferences),
  };
  if (me.role === "farmer") {
    const [f] = await db.select().from(farmers).where(eq(farmers.userId, me.id));
    if (f) {
      account.farm = {
        name: f.farmName,
        address: f.pickupAddress,
        city: account.city || cityName(f.zoneId, f.pickupAddress),
        areaHa: f.areaHa == null ? null : Number(f.areaHa),
        certification: f.certification,
        productionTypes: Array.isArray(f.productionTypes) ? (f.productionTypes as string[]) : [],
        description: f.description ?? "",
        lang: f.lang,
      };
    }
  } else if (me.role === "driver") {
    const [v] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.driverId, me.id))
      .orderBy(desc(vehicles.createdAt))
      .limit(1);
    if (v) account.vehicle = { type: v.type, capacityKg: v.capacityKg, plate: v.plate ?? "" };
    const [d] = await db
      .select({ address: drivers.address })
      .from(drivers)
      .where(eq(drivers.userId, me.id));
    account.driver = { address: d?.address ?? "" };
  } else if (me.role === "restaurant") {
    const [r] = await db.select().from(restaurants).where(eq(restaurants.userId, me.id));
    if (r) {
      account.billing = { ninea: r.ninea ?? "", email: r.billingEmail ?? account.email };
      account.restaurant = {
        name: r.name,
        cuisine: r.cuisine ?? "",
        description: r.description ?? "",
        contactName: r.contactName ?? "",
        capacity: r.capacity,
        address: r.address,
        receptionHours: (r.receptionHours as ReceptionHoursSetting | null) ?? null,
        paymentTermsDays: r.paymentTermsDays,
      };
    }
  }

  return {
    me,
    account,
    categories: await readCategories(db),
    units: await readUnits(db),
    recurringOrders: me.role === "restaurant" ? await readRecurringOrders(db, me.id) : [],
    disputes: await readDisputes(db, me),
    disputeStaff: me.role === "admin" ? await disputeStaff(db) : [],
    creditNotes: await readCreditNotes(db, me),
    ...(await readConversations(db, me)),
    supportTickets: await readTickets(db, me),
    reviews: await readReviews(db, me),
    returns: await readReturns(db, me),
    incidents: await readIncidents(db, me),
    fleet: me.role === "driver" ? await readDriverFleet(db, me.id) : null,
    book: me.role === "restaurant" ? await readRestaurantBook(db, me.id) : null,
    ...(await teamPart(db, me, member)),
    fleetQueue:
      me.role === "admin" ? await readFleetQueue(db, me.id) : { renewals: [], changeRequests: [] },
    moderation:
      me.role === "admin" && (await hasPermission(db, me.id, MODERATION_PERMISSION))
        ? await readModeration(db)
        : [],
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
      receptionWindowHours: rules.receptionWindowHours,
      paymentDeadlineHour: rules.paymentDeadlineHour,
      minPayout: rules.minPayout,
      deliveryHours: rules.deliveryHours,
      driverPay: rules.driverPay,
      cities: zoneList.filter((z) => z.active && !cityOfZone.has(z.id)).map((z) => z.name),
      paymentMethods: rules.paymentMethods,
      merchant: merchant ? { wave: merchant.wave, orangeMoney: merchant.orangeMoney } : null,
    },
    payments: adminPayments,
    invoices: invoiceList,
    wallet: farmerWallet,
    platformTransactions,
    ...(await platformParamsPart(db, me.role)),
    driverWallet,
    accounts,
    payouts: seesFinance ? adminPayouts : undefined,
    refunds: adminRefunds,
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

/** Équipe : le titulaire voit ses membres et leurs actions ; un membre voit
 * son rôle et ce qu'il peut faire. */
async function teamPart(
  db: Db,
  me: Viewer,
  member: { userId: string; name: string; role: string } | null,
): Promise<Pick<MarketSnapshot, "team" | "teamMembers" | "teamActivity">> {
  if (me.role !== "restaurant" && me.role !== "farmer") {
    return { team: null, teamMembers: [], teamActivity: [] };
  }
  const ownerRole = me.role as TeamOwnerRole;
  if (member) {
    const people = await loadPeopleNames(db, [me.id]);
    const caps =
      (TEAM_ROLES[ownerRole] as Record<string, { caps: TeamCap[] }>)[member.role]?.caps ?? [];
    return {
      team: {
        memberName: member.name,
        role: member.role,
        roleLabel: teamRoleLabel(ownerRole, member.role),
        ownerName: people.get(me.id) ?? "",
        caps,
      },
      teamMembers: [],
      teamActivity: [],
    };
  }
  const t = await readTeam(db, { id: me.id, role: ownerRole });
  return { team: null, teamMembers: t.members, teamActivity: t.activity };
}

async function loadPeopleNames(db: Db, ids: string[]) {
  const people = await loadPeople(db, ids);
  return new Map([...people].map(([id, p]) => [id, p.name]));
}
