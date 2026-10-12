import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
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
  restaurants,
  stockMovements,
  users,
  vehicles,
  zones,
} from "@/db/schema";
import type { MissionStatus, OrderStatus, PaymentMethod } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import {
  lastAddressSegment,
  missionPayout,
  routeEstimate,
  urgencyForSlot,
} from "@/lib/mission-pay";
import { checkMissionStep, checkOrderTransition, type OrderActor } from "@/lib/order-lifecycle";
import { zoneForAddress } from "@/lib/pricing";
import { newTrackingToken } from "@/lib/tracking-id";
import { PAYMENT_METHOD_DB, readRules, readZones } from "./snapshot.server";

// Opérations de la place de marché sur la base. Chaque règle est vérifiée
// ici, côté serveur, dans une transaction : le navigateur ne fait que
// demander. Une règle non respectée lève une MarketError, dont le message
// est montré tel quel à la personne (et la transaction est annulée).

export class MarketError extends Error {}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

function fail(message: string): never {
  throw new MarketError(message);
}

function fourDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(1000 + (buf[0] % 9000));
}

async function nextNumber(q: Q, sequence: string): Promise<number> {
  const rows = (await q.execute(
    sql`select nextval(${sequence}::regclass)::int as v`,
  )) as unknown as { v: number }[];
  return rows[0].v;
}

async function notifyUser(
  q: Q,
  userId: string,
  n: { type: "order" | "payment" | "stock" | "system"; title: string; body: string; link?: string },
) {
  await q.insert(notifications).values({ userId, ...n });
}

/** Ville d'un quartier (ou dernier morceau de l'adresse). */
async function cityFor(q: Q, zoneId: string | null, address: string): Promise<string> {
  if (zoneId) {
    const [row] = await q
      .select({ city: cities.name })
      .from(zones)
      .innerJoin(cities, eq(cities.id, zones.cityId))
      .where(eq(zones.id, zoneId));
    if (row) return row.city;
  }
  return lastAddressSegment(address);
}

const qty3 = (n: number) => Math.round(n * 1000) / 1000;

// --- Produits (producteur) -------------------------------------------------------

export type ProductInput = {
  id?: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  minStock: number;
  description?: string;
  minOrder?: number;
  availableFrom?: string;
  organic: boolean;
  paused: boolean;
  draft: boolean;
};

export async function saveProduct(db: Db, farmerId: string, input: ProductInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [cat] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, input.category));
    if (!cat) fail("Catégorie inconnue : choisissez-en une dans la liste.");
    const status = input.draft ? "draft" : input.paused ? "paused" : "active";
    const values = {
      categoryId: cat.id,
      name: input.name,
      description: input.description || null,
      unit: input.unit,
      price: input.price,
      minStock: input.minStock,
      minOrderQty: input.minOrder && input.minOrder > 0 ? input.minOrder : null,
      availableFrom: input.availableFrom || null,
      organic: input.organic,
      status: status as "draft" | "paused" | "active",
      updatedAt: new Date(),
    };
    if (!input.id) {
      const [row] = await tx
        .insert(products)
        .values({ ...values, farmerId, stockQty: input.stock })
        .returning({ id: products.id });
      if (input.stock > 0) {
        await tx.insert(stockMovements).values({
          productId: row.id,
          delta: input.stock,
          reason: "manual",
          actorId: farmerId,
        });
      }
      return row.id;
    }
    const [current] = await tx
      .select({ stock: products.stockQty })
      .from(products)
      .where(and(eq(products.id, input.id), eq(products.farmerId, farmerId)))
      .for("update");
    if (!current) fail("Produit introuvable.");
    const delta = qty3(input.stock - Number(current.stock));
    await tx
      .update(products)
      .set({ ...values, stockQty: input.stock })
      .where(eq(products.id, input.id));
    if (delta !== 0) {
      await tx.insert(stockMovements).values({
        productId: input.id,
        delta,
        reason: "adjustment",
        actorId: farmerId,
      });
    }
    return input.id;
  });
}

/** Retire un produit : supprimé s'il n'a jamais été commandé, sinon passé en
 * brouillon (les commandes passées gardent leur historique). */
export async function removeProduct(
  db: Db,
  farmerId: string,
  productId: string,
): Promise<{ removed: boolean; photoKeys: string[] }> {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.farmerId, farmerId)))
      .for("update");
    if (!p) fail("Produit introuvable.");
    const [used] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.productId, productId))
      .limit(1);
    if (used) {
      await tx
        .update(products)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(products.id, productId));
      return { removed: false, photoKeys: [] };
    }
    const photos = await tx
      .select({ fileId: productPhotos.fileId, key: files.storageKey })
      .from(productPhotos)
      .innerJoin(files, eq(files.id, productPhotos.fileId))
      .where(eq(productPhotos.productId, productId));
    await tx.delete(productPhotos).where(eq(productPhotos.productId, productId));
    await tx.delete(stockMovements).where(eq(stockMovements.productId, productId));
    await tx.delete(products).where(eq(products.id, productId));
    if (photos.length) {
      await tx.delete(files).where(
        inArray(
          files.id,
          photos.map((x) => x.fileId),
        ),
      );
    }
    return { removed: true, photoKeys: photos.map((x) => x.key) };
  });
}

/** Mouvement de stock saisi par le producteur (entrée, sortie, inventaire). */
export async function moveStock(
  db: Db,
  farmerId: string,
  input: { productId: string; type: "in" | "out" | "adjust"; qty: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select({ stock: products.stockQty })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.farmerId, farmerId)))
      .for("update");
    if (!p) fail("Produit introuvable.");
    const current = Number(p.stock);
    const next =
      input.type === "in"
        ? current + input.qty
        : input.type === "out"
          ? current - input.qty
          : input.qty;
    if (next < 0) fail(`Sortie impossible : il ne reste que ${current} en stock.`);
    const delta = qty3(next - current);
    if (delta === 0) return;
    await tx
      .update(products)
      .set({ stockQty: next, updatedAt: new Date() })
      .where(eq(products.id, input.productId));
    await tx.insert(stockMovements).values({
      productId: input.productId,
      delta,
      reason: input.type === "adjust" ? "adjustment" : "manual",
      actorId: farmerId,
    });
  });
}

/** Photo ajoutée à un produit (déjà envoyée dans le stockage). */
export async function addProductPhoto(
  db: Db,
  farmerId: string,
  input: { productId: string; storageKey: string; mime: string; size: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.farmerId, farmerId)));
    if (!p) fail("Produit introuvable.");
    const [f] = await tx
      .insert(files)
      .values({
        ownerId: farmerId,
        storageKey: input.storageKey,
        mime: input.mime,
        sizeBytes: input.size,
      })
      .returning({ id: files.id });
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(productPhotos)
      .where(eq(productPhotos.productId, input.productId));
    await tx
      .insert(productPhotos)
      .values({ productId: input.productId, fileId: f.id, position: n });
  });
}

// --- Commande (restaurant) ----------------------------------------------------------

export type PlaceOrderInput = {
  lines: { productId: string; qty: number }[];
  deliveryAddress: string;
  slotStart: string;
  slotLabel: string;
  paymentMethod: PaymentMethod;
  shortagePreference: "partial" | "cancel";
  instructions?: string;
};

export type PlacedOrder = {
  checkoutReference: string;
  orders: { id: string; reference: string; farmerId: string; subtotal: number }[];
};

const DAY_MS = 24 * 3600_000;

export async function placeOrder(
  db: Db,
  restaurantId: string,
  input: PlaceOrderInput,
): Promise<PlacedOrder> {
  return db.transaction(async (tx) => {
    const [resto] = await tx.select().from(restaurants).where(eq(restaurants.userId, restaurantId));
    if (!resto) fail("Votre établissement n'est pas encore enregistré : contactez le support.");
    const rules = await readRules(tx as unknown as Db);
    const zoneList = await readZones(tx as unknown as Db);
    const restoCity = await cityFor(tx, resto.zoneId, resto.address);
    const zone = zoneForAddress(zoneList, restoCity, input.deliveryAddress);
    if (!zone) fail("Cette adresse n'est dans aucune zone desservie par Diambar Agro.");
    if (!zone.active) {
      fail(`La zone ${zone.name} n'est pas encore desservie : commande impossible pour le moment.`);
    }

    // Créneau : jamais le jour même ; après l'heure limite, pas avant le
    // surlendemain (Dakar est à l'heure UTC toute l'année).
    const now = new Date();
    const slot = new Date(input.slotStart);
    if (Number.isNaN(slot.getTime())) fail("Créneau de livraison invalide.");
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const firstDay = today + (now.getUTCHours() < rules.cutoffHour ? 1 : 2) * DAY_MS;
    if (slot.getTime() < firstDay) {
      fail(
        `Passé ${rules.cutoffHour} h, la première livraison possible est après-demain : choisissez un autre créneau.`,
      );
    }
    if (slot.getTime() > today + 15 * DAY_MS) fail("Créneau trop lointain (14 jours au plus).");

    if (!rules.paymentMethods.includes(input.paymentMethod)) {
      fail(`Le paiement par ${input.paymentMethod} n'est pas proposé pour le moment.`);
    }

    // Lignes regroupées par produit, puis produits verrouillés : deux
    // commandes simultanées ne peuvent pas prendre le même dernier article.
    const wanted = new Map<string, number>();
    for (const l of input.lines)
      wanted.set(l.productId, qty3((wanted.get(l.productId) ?? 0) + l.qty));
    const ids = [...wanted.keys()];
    if (!ids.length) fail("Votre panier est vide.");
    const rows = await tx
      .select({
        id: products.id,
        name: products.name,
        unit: products.unit,
        price: products.price,
        stock: products.stockQty,
        minOrderQty: products.minOrderQty,
        availableFrom: products.availableFrom,
        status: products.status,
        farmerId: products.farmerId,
      })
      .from(products)
      .where(inArray(products.id, ids))
      .orderBy(products.id)
      .for("update");
    const farmerStatus = rows.length
      ? await tx
          .select({ id: users.id, status: users.status, name: farmers.farmName })
          .from(users)
          .innerJoin(farmers, eq(farmers.userId, users.id))
          .where(
            inArray(
              users.id,
              rows.map((r) => r.farmerId),
            ),
          )
      : [];
    const farmerById = new Map(farmerStatus.map((f) => [f.id, f]));
    const shortages: string[] = [];
    for (const id of ids) {
      const p = rows.find((r) => r.id === id);
      const qty = wanted.get(id)!;
      if (!p) fail("Un produit du panier n'existe plus : retirez-le.");
      const farmer = farmerById.get(p.farmerId);
      if (farmer?.status !== "active") fail(`${p.name} n'est plus proposé par son producteur.`);
      if (p.status === "draft") fail(`${p.name} a été retiré du catalogue.`);
      if (p.status === "paused") fail(`${p.name} est hors saison pour le moment.`);
      if (p.availableFrom && new Date(p.availableFrom).getTime() > slot.getTime()) {
        fail(
          `${p.name} n'est disponible qu'à partir du ${new Date(p.availableFrom).toLocaleDateString("fr-FR")}.`,
        );
      }
      const min = p.minOrderQty != null ? Number(p.minOrderQty) : 0;
      if (min && qty < min) fail(`${p.name} : minimum ${min} ${p.unit} par commande.`);
      if (qty > Number(p.stock)) shortages.push(`${p.name} (${Number(p.stock)} disponible(s))`);
    }
    if (shortages.length) {
      fail(`Stock insuffisant : ${shortages.join(", ")}. Ajustez votre panier.`);
    }

    const groups = new Map<string, { productId: string; qty: number }[]>();
    for (const [productId, qty] of wanted) {
      const p = rows.find((r) => r.id === productId)!;
      groups.set(p.farmerId, [...(groups.get(p.farmerId) ?? []), { productId, qty }]);
    }
    const subtotals = new Map<string, number>();
    for (const [farmerId, lines] of groups) {
      const sub = lines.reduce((s, l) => {
        const p = rows.find((r) => r.id === l.productId)!;
        return s + Math.round(l.qty * p.price);
      }, 0);
      if (sub < rules.minOrderPerProducer) {
        fail(
          `Minimum ${formatFCFA(rules.minOrderPerProducer)} de marchandise par producteur : complétez chez ${farmerById.get(farmerId)?.name ?? "ce producteur"}.`,
        );
      }
      subtotals.set(farmerId, sub);
    }

    const fee = zone.baseFee;
    const subtotal = [...subtotals.values()].reduce((s, v) => s + v, 0);
    const deliveryFee = fee * groups.size;
    const total = subtotal + deliveryFee;
    const realZone = await tx.select({ id: zones.id }).from(zones).where(eq(zones.id, zone.id));
    const [checkout] = await tx
      .insert(checkouts)
      .values({
        reference: `PAN-${await nextNumber(tx, "checkout_reference_seq")}`,
        restaurantId,
        slotStart: slot,
        slotLabel: input.slotLabel,
        deliveryAddress: input.deliveryAddress,
        instructions: input.instructions || null,
        zoneId: realZone.length ? zone.id : null,
        paymentMode: input.paymentMethod === "Espèces" ? "cash" : "prepaid",
        subtotal,
        deliveryFee,
        discount: 0,
        total,
      })
      .returning();

    const created: PlacedOrder["orders"] = [];
    for (const [farmerId, lines] of groups) {
      const sub = subtotals.get(farmerId)!;
      const [order] = await tx
        .insert(orders)
        .values({
          reference: `CMD-${await nextNumber(tx, "order_reference_seq")}`,
          checkoutId: checkout.id,
          restaurantId,
          farmerId,
          status: "pending",
          shortagePreference: input.shortagePreference,
          pickupCode: fourDigitCode(),
          deliveryCode: fourDigitCode(),
          trackingToken: newTrackingToken(),
          subtotal: sub,
          deliveryFee: fee,
        })
        .returning();
      for (const l of lines) {
        const p = rows.find((r) => r.id === l.productId)!;
        await tx.insert(orderItems).values({
          orderId: order.id,
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          unitPrice: p.price,
          qtyOrdered: l.qty,
        });
        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} - ${l.qty}`, updatedAt: new Date() })
          .where(eq(products.id, p.id));
        await tx.insert(stockMovements).values({
          productId: p.id,
          delta: -l.qty,
          reason: "order_reserved",
          orderId: order.id,
          actorId: restaurantId,
        });
      }
      await tx
        .insert(orderEvents)
        .values({ orderId: order.id, status: "pending", actorId: restaurantId });
      await notifyUser(tx, farmerId, {
        type: "order",
        title: "Nouvelle commande",
        body: `${order.reference} — ${formatFCFA(sub)} · à confirmer`,
        link: `/farmer/orders/${order.id}`,
      });
      created.push({ id: order.id, reference: order.reference, farmerId, subtotal: sub });
    }
    await tx.insert(payments).values({
      checkoutId: checkout.id,
      method: PAYMENT_METHOD_DB[input.paymentMethod],
      amount: total,
      status: "pending",
    });
    return { checkoutReference: checkout.reference, orders: created };
  });
}

// --- Statuts de commande ------------------------------------------------------------

type OrderRow = typeof orders.$inferSelect;

const RESTAURANT_STATUS_NOTIF: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  confirmed: { title: "Commande confirmée", body: "est confirmée par le producteur" },
  preparing: { title: "Commande en préparation", body: "est en préparation chez le producteur" },
  delivering: { title: "Livraison en route", body: "a été enlevée par le livreur et arrive" },
  delivered: { title: "Commande livrée", body: "a été livrée" },
  cancelled: { title: "Commande annulée", body: "a été annulée" },
};

async function lockOrder(tx: Tx, orderId: string): Promise<OrderRow> {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) fail("Commande introuvable.");
  return o;
}

/** Change le statut (avec son historique) et prévient le restaurant. */
async function applyStatus(
  tx: Tx,
  o: OrderRow,
  status: OrderStatus,
  actor: OrderActor,
  actorId: string | null,
  note?: string,
  extra: Partial<typeof orders.$inferInsert> = {},
) {
  await tx
    .update(orders)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === "cancelled" ? { cancelReason: note ?? null } : {}),
      ...extra,
    })
    .where(eq(orders.id, o.id));
  await tx.insert(orderEvents).values({ orderId: o.id, status, actorId, note: note ?? null });
  const n = RESTAURANT_STATUS_NOTIF[status];
  if (n && actor !== "restaurant") {
    await notifyUser(tx, o.restaurantId, {
      type: "order",
      title: n.title,
      body: `${o.reference} ${n.body}${note ? ` — ${note}` : ""}`,
      link: `/restaurant/orders/${o.id}`,
    });
  }
}

/** Ouvre la course de livraison d'une commande confirmée (une seule fois). */
async function openMission(tx: Tx, o: OrderRow) {
  const [existing] = await tx
    .select({ id: missions.id, status: missions.status })
    .from(missions)
    .where(eq(missions.orderId, o.id));
  if (existing && existing.status !== "cancelled") return;
  const [c] = await tx.select().from(checkouts).where(eq(checkouts.id, o.checkoutId));
  const [f] = await tx.select().from(farmers).where(eq(farmers.userId, o.farmerId));
  const pickupCity = f ? await cityFor(tx, f.zoneId, f.pickupAddress) : "Dakar";
  const dropoffCity = lastAddressSegment(c.deliveryAddress);
  const { distanceKm } = routeEstimate(pickupCity, dropoffCity);
  const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const weightKg = qty3(lines.reduce((s, l) => s + Number(l.qtyConfirmed ?? l.qtyOrdered), 0));
  const values = {
    driverId: null,
    status: "available" as MissionStatus,
    scheduledFor: c.slotStart,
    distanceKm,
    weightKg,
    payout: missionPayout(distanceKm, weightKg),
    urgency: urgencyForSlot(c.slotStart),
    updatedAt: new Date(),
  };
  let missionId: string;
  let reference: string;
  if (existing) {
    // Mission annulée puis commande de nouveau confirmée : on la rouvre.
    const [m] = await tx
      .update(missions)
      .set(values)
      .where(eq(missions.id, existing.id))
      .returning({ id: missions.id, reference: missions.reference });
    missionId = m.id;
    reference = m.reference;
  } else {
    const [m] = await tx
      .insert(missions)
      .values({
        ...values,
        orderId: o.id,
        reference: `MIS-${await nextNumber(tx, "mission_reference_seq")}`,
      })
      .returning({ id: missions.id, reference: missions.reference });
    missionId = m.id;
    reference = m.reference;
  }
  await tx.insert(missionEvents).values({ missionId, status: "available" });
  // Les livreurs actifs sont prévenus qu'une course est ouverte.
  const activeDrivers = await tx
    .select({ id: drivers.userId })
    .from(drivers)
    .innerJoin(users, eq(users.id, drivers.userId))
    .where(eq(users.status, "active"));
  for (const d of activeDrivers) {
    await notifyUser(tx, d.id, {
      type: "order",
      title: "Nouvelle course disponible",
      body: `${reference} · ${pickupCity} → ${dropoffCity}, ${formatFCFA(values.payout)}`,
      link: `/driver/missions/${missionId}`,
    });
  }
}

/** Effets d'une annulation : stock remis en vente, course annulée, parties
 * prévenues. (Le remboursement d'un paiement déjà reçu arrive au lot 1.4.) */
async function cancelCascade(
  tx: Tx,
  o: OrderRow,
  actor: OrderActor,
  actorId: string | null,
  note?: string,
) {
  const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  for (const l of lines) {
    const reserved = Number(l.qtyConfirmed ?? l.qtyOrdered);
    if (reserved <= 0) continue;
    await tx
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${reserved}`, updatedAt: new Date() })
      .where(eq(products.id, l.productId));
    await tx.insert(stockMovements).values({
      productId: l.productId,
      delta: reserved,
      reason: "order_cancelled",
      orderId: o.id,
      actorId,
    });
  }
  const open = await tx
    .select()
    .from(missions)
    .where(
      and(eq(missions.orderId, o.id), notInArray(missions.status, ["delivered", "cancelled"])),
    );
  for (const m of open) {
    await tx
      .update(missions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(missions.id, m.id));
    await tx
      .insert(missionEvents)
      .values({ missionId: m.id, status: "cancelled", actorId, note: "Commande annulée" });
    if (m.driverId) {
      await notifyUser(tx, m.driverId, {
        type: "order",
        title: "Mission annulée",
        body: `${m.reference} : la commande ${o.reference} a été annulée, inutile de vous déplacer`,
        link: `/driver/missions/${m.id}`,
      });
    }
  }
  if (actor !== "farmer") {
    await notifyUser(tx, o.farmerId, {
      type: "order",
      title: "Commande annulée",
      body: `${o.reference} a été annulée${actor === "restaurant" ? " par le restaurant" : ""}${note ? ` — ${note}` : ""}`,
      link: `/farmer/orders/${o.id}`,
    });
  }
}

/** Changement de statut demandé par un acteur (producteur, restaurant, admin). */
export async function setOrderStatus(
  db: Db,
  me: { id: string; actor: OrderActor },
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (me.actor === "farmer" && o.farmerId !== me.id) fail("Commande introuvable.");
    if (me.actor === "restaurant" && o.restaurantId !== me.id) fail("Commande introuvable.");
    if (me.actor === "driver") fail("Le livreur fait avancer la commande depuis sa mission.");
    const check = checkOrderTransition(o.status, status, me.actor);
    if (!check.ok) fail(check.message);
    if (status === "confirmed") {
      await tx
        .update(orderItems)
        .set({ qtyConfirmed: sql`${orderItems.qtyOrdered}` })
        .where(eq(orderItems.orderId, o.id));
    }
    await applyStatus(tx, o, status, me.actor, me.id, note);
    if (status === "confirmed") await openMission(tx, o);
    if (status === "cancelled") await cancelCascade(tx, o, me.actor, me.id, note);
  });
}

/** Le producteur accepte en indiquant ce qu'il a vraiment. Selon la
 * préférence du restaurant, la commande est livrée en partie ou annulée. */
export async function confirmOrder(
  db: Db,
  farmerId: string,
  orderId: string,
  available: Record<string, number>,
): Promise<{ outcome: "confirmed" | "adjusted" | "cancelled" }> {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (o.farmerId !== farmerId) fail("Commande introuvable.");
    if (o.status !== "pending") fail("Seule une commande en attente peut être confirmée.");
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const kept = lines.map((l) => {
      const ordered = Number(l.qtyOrdered);
      const have = available[l.productId];
      const qty =
        have === undefined ? ordered : Math.min(ordered, Math.max(0, qty3(Number(have) || 0)));
      return { line: l, ordered, qty };
    });
    const missing = kept.reduce(
      (s, k) => s + Math.round((k.ordered - k.qty) * k.line.unitPrice),
      0,
    );
    if (missing === 0) {
      await tx
        .update(orderItems)
        .set({ qtyConfirmed: sql`${orderItems.qtyOrdered}` })
        .where(eq(orderItems.orderId, o.id));
      await applyStatus(tx, o, "confirmed", "farmer", farmerId);
      await openMission(tx, o);
      return { outcome: "confirmed" as const };
    }
    if (kept.every((k) => k.qty === 0) || o.shortagePreference === "cancel") {
      const note = "Quantités indisponibles chez le producteur";
      await applyStatus(tx, o, "cancelled", "farmer", farmerId, note);
      await cancelCascade(tx, o, "farmer", farmerId, note);
      return { outcome: "cancelled" as const };
    }
    for (const k of kept) {
      await tx.update(orderItems).set({ qtyConfirmed: k.qty }).where(eq(orderItems.id, k.line.id));
      const diff = qty3(k.ordered - k.qty);
      if (diff > 0) {
        await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} + ${diff}`, updatedAt: new Date() })
          .where(eq(products.id, k.line.productId));
        await tx.insert(stockMovements).values({
          productId: k.line.productId,
          delta: diff,
          reason: "order_adjusted",
          orderId: o.id,
          actorId: farmerId,
        });
      }
    }
    const newSubtotal = kept.reduce((s, k) => s + Math.round(k.qty * k.line.unitPrice), 0);
    await notifyUser(tx, o.restaurantId, {
      type: "order",
      title: "Quantités ajustées",
      body: `${o.reference} : le producteur n'a pas tout, ${formatFCFA(missing)} en moins`,
      link: `/restaurant/orders/${o.id}`,
    });
    await applyStatus(
      tx,
      o,
      "confirmed",
      "farmer",
      farmerId,
      "quantités ajustées par le producteur",
      { subtotal: newSubtotal },
    );
    await openMission(tx, o);
    return { outcome: "adjusted" as const };
  });
}

/** Contrôle à la réception (restaurant), dans le délai réglé par l'admin. */
export async function reportReception(
  db: Db,
  restaurantId: string,
  orderId: string,
  input: { lines: { productId: string; refusedQty: number; reason: string }[]; note?: string },
): Promise<{ refusedAmount: number }> {
  return db.transaction(async (tx) => {
    const o = await lockOrder(tx, orderId);
    if (o.restaurantId !== restaurantId) fail("Commande introuvable.");
    if (o.status !== "delivered") fail("La réception se contrôle une fois la commande livrée.");
    if (o.receptionAt) fail("La réception a déjà été contrôlée.");
    if (o.receptionDeadline && o.receptionDeadline.getTime() < Date.now()) {
      fail("Le délai de contrôle après la livraison est dépassé : passez par le support.");
    }
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    let amount = 0;
    for (const l of input.lines) {
      const line = lines.find((x) => x.productId === l.productId);
      if (!line) continue;
      const max = Number(line.qtyConfirmed ?? line.qtyOrdered);
      const refused = Math.min(max, Math.max(0, qty3(l.refusedQty)));
      if (refused <= 0) continue;
      amount += Math.round(refused * line.unitPrice);
      await tx
        .update(orderItems)
        .set({ qtyRefused: refused, refusalReason: l.reason.slice(0, 300) })
        .where(eq(orderItems.id, line.id));
    }
    await tx
      .update(orders)
      .set({ receptionAt: new Date(), receptionNote: input.note || null, updatedAt: new Date() })
      .where(eq(orders.id, o.id));
    if (amount > 0) {
      await notifyUser(tx, o.farmerId, {
        type: "order",
        title: "Refus à la réception",
        body: `${o.reference} : ${formatFCFA(amount)} refusés par le restaurant`,
        link: `/farmer/orders/${o.id}`,
      });
    }
    return { refusedAmount: amount };
  });
}

// --- Missions (livreur) ----------------------------------------------------------------

async function lockMission(tx: Tx, missionId: string) {
  const [m] = await tx.select().from(missions).where(eq(missions.id, missionId)).for("update");
  if (!m) fail("Mission introuvable.");
  return m;
}

export async function acceptMission(db: Db, driverId: string, missionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, missionId);
    if (m.status !== "available") {
      fail("Cette mission n'est plus disponible (déjà prise par un autre livreur).");
    }
    // Capacité du véhicule : la charge des courses en cours compte aussi.
    const fleet = await tx
      .select({ capacity: vehicles.capacityKg })
      .from(vehicles)
      .where(and(eq(vehicles.driverId, driverId), eq(vehicles.status, "active")));
    if (fleet.length) {
      const capacity = Math.max(...fleet.map((v) => v.capacity));
      const [{ load }] = await tx
        .select({ load: sql<number>`coalesce(sum(${missions.weightKg}), 0)::float` })
        .from(missions)
        .where(
          and(
            eq(missions.driverId, driverId),
            inArray(missions.status, ["accepted", "pickup", "loaded"]),
          ),
        );
      const weight = Number(m.weightKg ?? 0);
      if (load + weight > capacity) {
        fail(
          `Charge trop lourde : ${weight} kg en plus de ${load} kg déjà prévus, pour ${capacity} kg de capacité.`,
        );
      }
    }
    await tx
      .update(missions)
      .set({ driverId, status: "accepted", updatedAt: new Date() })
      .where(eq(missions.id, m.id));
    await tx
      .insert(missionEvents)
      .values({ missionId: m.id, status: "accepted", actorId: driverId });
    const [o] = await tx.select().from(orders).where(eq(orders.id, m.orderId));
    const [d] = await tx
      .select({ first: users.firstName, last: users.lastName })
      .from(users)
      .where(eq(users.id, driverId));
    const driverName = d ? `${d.first} ${d.last}`.trim() : "Un livreur";
    await notifyUser(tx, o.restaurantId, {
      type: "order",
      title: "Livreur trouvé",
      body: `${driverName} livrera ${o.reference}`,
      link: `/restaurant/orders/${o.id}`,
    });
    await notifyUser(tx, o.farmerId, {
      type: "order",
      title: "Livreur en route",
      body: `${driverName} viendra récupérer ${o.reference} : préparez le code d'enlèvement`,
      link: `/farmer/orders/${o.id}`,
    });
  });
}

/** Étape du livreur. Le code du producteur prouve l'enlèvement ; le code du
 * restaurant et une photo prouvent la livraison. */
export async function missionStep(
  db: Db,
  driverId: string,
  missionId: string,
  status: MissionStatus,
  code?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, missionId);
    if (m.driverId !== driverId) fail("Cette mission n'est pas (ou plus) attribuée à vous.");
    const check = checkMissionStep(m.status, status);
    if (!check.ok) fail(check.message);
    const o = await lockOrder(tx, m.orderId);
    if (status === "loaded" && code?.trim() !== o.pickupCode) {
      fail("Code d'enlèvement incorrect : demandez-le au producteur.");
    }
    if (status === "delivered") {
      if (code?.trim() !== o.deliveryCode) {
        fail("Code de remise incorrect : demandez-le au restaurant.");
      }
      const [proof] = await tx
        .select({ id: deliveryProofs.id })
        .from(deliveryProofs)
        .where(and(eq(deliveryProofs.missionId, m.id), eq(deliveryProofs.stage, "dropoff")))
        .limit(1);
      if (!proof) fail("Ajoutez au moins une photo de la marchandise livrée.");
    }
    await tx.update(missions).set({ status, updatedAt: new Date() }).where(eq(missions.id, m.id));
    await tx.insert(missionEvents).values({ missionId: m.id, status, actorId: driverId });

    if (status === "loaded" && o.status !== "delivering") {
      await applyStatus(tx, o, "delivering", "driver", driverId);
      await notifyUser(tx, o.farmerId, {
        type: "order",
        title: "Commande enlevée",
        body: `${o.reference} a été récupérée par le livreur`,
        link: `/farmer/orders/${o.id}`,
      });
    }
    if (status === "delivered") {
      const rules = await readRules(tx as unknown as Db);
      if (o.status !== "delivering") await applyStatus(tx, o, "delivering", "driver", driverId);
      const now = new Date();
      await applyStatus(tx, o, "delivered", "driver", driverId, undefined, {
        deliveredAt: now,
        receptionDeadline: new Date(now.getTime() + rules.receptionWindowHours * 3600_000),
        deliveredWithCode: true,
      });
      await notifyUser(tx, o.farmerId, {
        type: "payment",
        title: "Commande livrée",
        body: `${o.reference} livrée · ${formatFCFA(o.subtotal)} de marchandise`,
        link: `/farmer/orders/${o.id}`,
      });
    }
  });
}

/** Désistement avant le chargement : la course retourne aux autres livreurs. */
export async function withdrawMission(
  db: Db,
  driverId: string,
  missionId: string,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, missionId);
    if (m.driverId !== driverId) fail("Cette mission ne vous est plus attribuée.");
    if (m.status !== "accepted" && m.status !== "pickup") {
      fail("Désistement impossible une fois la marchandise chargée : signalez plutôt un incident.");
    }
    await tx
      .update(missions)
      .set({ driverId: null, status: "available", updatedAt: new Date() })
      .where(eq(missions.id, m.id));
    await tx.insert(missionEvents).values({
      missionId: m.id,
      status: "available",
      actorId: driverId,
      note: `Désistement du livreur : ${reason.slice(0, 300)}`,
    });
  });
}

/** Arrivée chez le producteur ou le restaurant (début de l'attente payée). */
export async function markArrived(
  db: Db,
  driverId: string,
  missionId: string,
  stage: "pickup" | "dropoff",
): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, missionId);
    if (m.driverId !== driverId) fail("Cette mission ne vous est plus attribuée.");
    const note = `arrivee:${stage}`;
    const [already] = await tx
      .select({ id: missionEvents.id })
      .from(missionEvents)
      .where(and(eq(missionEvents.missionId, m.id), eq(missionEvents.note, note)))
      .limit(1);
    if (already) return;
    await tx
      .insert(missionEvents)
      .values({ missionId: m.id, status: null, actorId: driverId, note });
  });
}

/** Preuve photo d'une étape (fichier déjà envoyé dans le stockage). */
export async function addDeliveryProof(
  db: Db,
  driverId: string,
  input: {
    missionId: string;
    stage: "pickup" | "dropoff";
    storageKey: string;
    mime: string;
    size: number;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, input.missionId);
    if (m.driverId !== driverId) fail("Cette mission ne vous est plus attribuée.");
    if (m.status === "delivered" || m.status === "cancelled") {
      fail("Cette mission est terminée : plus de photo à ajouter.");
    }
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(deliveryProofs)
      .where(eq(deliveryProofs.missionId, m.id));
    if (n >= 6) fail("Six photos au plus par mission.");
    const [f] = await tx
      .insert(files)
      .values({
        ownerId: driverId,
        storageKey: input.storageKey,
        mime: input.mime,
        sizeBytes: input.size,
      })
      .returning({ id: files.id });
    await tx.insert(deliveryProofs).values({ missionId: m.id, fileId: f.id, stage: input.stage });
  });
}

/** Réaffectation par l'admin : le nouveau livreur reprend la course. */
export async function reassignMission(
  db: Db,
  adminId: string,
  missionId: string,
  newDriverId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const m = await lockMission(tx, missionId);
    if (m.status === "delivered" || m.status === "cancelled") fail("Cette course est terminée.");
    const [d] = await tx
      .select({ id: drivers.userId })
      .from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(and(eq(drivers.userId, newDriverId), eq(users.status, "active")));
    if (!d) fail("Livreur introuvable ou inactif.");
    const previous = m.driverId;
    await tx
      .update(missions)
      .set({
        driverId: newDriverId,
        status: m.status === "available" ? "accepted" : m.status,
        updatedAt: new Date(),
      })
      .where(eq(missions.id, m.id));
    await tx.insert(missionEvents).values({
      missionId: m.id,
      status: m.status === "available" ? "accepted" : null,
      actorId: adminId,
      note: "Réaffectée par l'administration",
    });
    if (previous && previous !== newDriverId) {
      await notifyUser(tx, previous, {
        type: "order",
        title: "Mission réaffectée",
        body: `${m.reference} a été réaffectée à un autre livreur`,
      });
    }
    await notifyUser(tx, newDriverId, {
      type: "order",
      title: "Nouvelle mission affectée",
      body: `${m.reference} vous a été affectée par l'administration`,
      link: `/driver/missions/${m.id}`,
    });
  });
}

// --- Notifications -------------------------------------------------------------------

export async function markNotificationsRead(
  db: Db,
  userId: string,
  ids: string[] | "all",
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      ids === "all"
        ? and(eq(notifications.userId, userId), sql`${notifications.readAt} is null`)
        : and(eq(notifications.userId, userId), inArray(notifications.id, ids.length ? ids : [""])),
    );
}
