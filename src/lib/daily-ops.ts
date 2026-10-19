import type { Mission, RestaurantOrder, Transaction } from "@/data/mocks";
import { DRIVER_COMMISSION_RATE } from "@/lib/commission";
import { bracketLabel, type DeliveryPricing } from "@/lib/delivery-pricing";
import { orderAmounts } from "@/lib/pricing";

// Indicateurs quotidiens d'exploitation (modèle Uber Eats / Twiga) : ce qui
// dit, chaque matin, si la plateforme a bien servi ses clients et si elle
// gagne ou perd de l'argent sur chaque commande.

const sameDay = (iso: string | undefined, day: Date) => {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
};

const deliveredAt = (o: RestaurantOrder) =>
  [...o.statusHistory].reverse().find((h) => h.status === "delivered")?.at;

// Une livraison est à l'heure si elle arrive au plus tard une heure après
// l'heure choisie par le restaurant.
export const ON_TIME_WINDOW_MS = 3600_000;

export type DailyOps = {
  ordersPlaced: number;
  delivered: number;
  cancelled: number;
  /** Quantités livrées et acceptées / quantités commandées (commandes livrées ou annulées du jour). */
  serviceRate: number | null;
  /** Livraisons à l'heure / livraisons avec créneau. */
  onTimeRate: number | null;
  disputesOpened: number;
  disputeRate: number | null;
  /** Espèces encaissées par les livreurs, à reverser à la plateforme. */
  cashToReconcile: number;
  gmv: number;
  /** Revenus plateforme − coûts plateforme, par commande livrée. */
  marginPerOrder: number | null;
  margin: {
    commissions: number;
    deliveryFees: number;
    driverCommissions: number;
    driverPayouts: number;
    discounts: number;
    platformRefunds: number;
    total: number;
  };
  unassigned: Mission[];
};

export function computeDailyOps(input: {
  day: Date;
  /** Commission de Diambar sur les courses (%), réglée par l'admin. */
  driverCommissionRate?: number;
  restaurantOrders: RestaurantOrder[];
  missions: Mission[];
  transactions: Transaction[];
  disputes: { openedAt: string }[];
  refunds: {
    status: string;
    decidedAt?: string;
    createdAt: string;
    amount: number;
    bornBy?: string;
  }[];
}): DailyOps {
  const { day } = input;
  const placed = input.restaurantOrders.filter((o) => sameDay(o.createdAt, day));
  const deliveredToday = input.restaurantOrders.filter(
    (o) => o.status === "delivered" && sameDay(deliveredAt(o), day),
  );
  const cancelledToday = input.restaurantOrders.filter(
    (o) =>
      o.status === "cancelled" &&
      sameDay([...o.statusHistory].reverse().find((h) => h.status === "cancelled")?.at, day),
  );

  // Taux de service : ce qui a été livré et accepté, rapporté à ce qui était
  // commandé (une commande annulée compte pour 0).
  let ordered = 0;
  let served = 0;
  for (const o of deliveredToday) {
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    const refused = (o.reception?.lines ?? []).reduce((s, l) => s + l.refusedQty, 0);
    ordered += qty;
    served += qty - refused;
  }
  for (const o of cancelledToday) ordered += o.items.reduce((s, i) => s + i.qty, 0);

  const withSlot = deliveredToday.filter((o) => o.slotStart);
  const onTime = withSlot.filter(
    (o) =>
      new Date(deliveredAt(o)!).getTime() <= new Date(o.slotStart!).getTime() + ON_TIME_WINDOW_MS,
  );

  const disputesOpened = input.disputes.filter((d) => sameDay(d.openedAt, day)).length;

  const cashToReconcile = deliveredToday
    .filter((o) => o.paymentMethod === "Espèces")
    .reduce((s, o) => s + o.total, 0);

  const refs = new Set(deliveredToday.map((o) => o.reference));
  const commissions = input.transactions
    .filter((t) => refs.has(t.orderRef) && t.kind !== "refund_adjustment")
    .reduce((s, t) => s + t.commission, 0);
  const deliveredMissions = input.missions.filter(
    (m) => m.status === "delivered" && refs.has(m.orderRef),
  );
  const driverPayouts = deliveredMissions.reduce((s, m) => s + m.payout, 0);
  const driverCommissions = deliveredMissions.reduce(
    (s, m) =>
      s + Math.round(m.payout * ((input.driverCommissionRate ?? DRIVER_COMMISSION_RATE) / 100)),
    0,
  );
  let deliveryFees = 0;
  let discounts = 0;
  let gmv = 0;
  for (const o of deliveredToday) {
    const a = orderAmounts(o);
    deliveryFees += a.deliveryFee;
    discounts += a.promoDiscount + a.creditApplied;
    gmv += a.subtotal;
  }
  const platformRefunds = input.refunds
    .filter((r) => r.status === "paid" && r.bornBy === "platform" && sameDay(r.decidedAt, day))
    .reduce((s, r) => s + r.amount, 0);
  const total =
    commissions + deliveryFees + driverCommissions - driverPayouts - discounts - platformRefunds;

  const unassigned = input.missions
    .filter((m) => m.status === "available")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  return {
    ordersPlaced: placed.length,
    delivered: deliveredToday.length,
    cancelled: cancelledToday.length,
    serviceRate: ordered > 0 ? served / ordered : null,
    onTimeRate: withSlot.length > 0 ? onTime.length / withSlot.length : null,
    disputesOpened,
    disputeRate: deliveredToday.length > 0 ? disputesOpened / deliveredToday.length : null,
    cashToReconcile,
    gmv,
    marginPerOrder: deliveredToday.length > 0 ? Math.round(total / deliveredToday.length) : null,
    margin: {
      commissions,
      deliveryFees,
      driverCommissions,
      driverPayouts,
      discounts,
      platformRefunds,
      total,
    },
    unassigned,
  };
}

// --- Livraisons à perte -----------------------------------------------------------

export type DeliveryMargin = {
  mission: Mission;
  /** Frais de livraison payés par le restaurant pour cette commande. */
  fee: number;
  /** Ce que la course coûte à la plateforme : prix payé au livreur, moins
   * la commission livreur qu'elle reprend. */
  cost: number;
  margin: number;
};

/** Courses du jour (prévues ou livrées) : frais facturés au restaurant face
 * à ce que la plateforme paie au livreur. */
export function deliveryMargins(input: {
  day: Date;
  driverCommissionRate?: number;
  restaurantOrders: RestaurantOrder[];
  missions: Mission[];
}): DeliveryMargin[] {
  const out: DeliveryMargin[] = [];
  for (const m of input.missions) {
    if (m.status === "cancelled") continue;
    const deliveredOn = m.statusHistory?.find((h) => h.status === "delivered")?.at;
    const ofTheDay =
      m.status === "delivered"
        ? sameDay(deliveredOn, input.day)
        : sameDay(m.scheduledFor, input.day);
    if (!ofTheDay) continue;
    const order = input.restaurantOrders.find((o) => o.reference === m.orderRef);
    if (!order) continue;
    const fee = orderAmounts(order).deliveryFee;
    const rate = input.driverCommissionRate ?? DRIVER_COMMISSION_RATE;
    const cost = m.payout - Math.round(m.payout * (rate / 100));
    out.push({ mission: m, fee, cost, margin: fee - cost });
  }
  return out;
}

/** Courses du jour où les frais facturés au restaurant ne couvrent pas ce
 * que la plateforme paie au livreur, de la pire à la moins mauvaise. */
export function lossMakingDeliveries(input: {
  day: Date;
  driverCommissionRate?: number;
  restaurantOrders: RestaurantOrder[];
  missions: Mission[];
}): DeliveryMargin[] {
  return deliveryMargins(input)
    .filter((d) => d.margin < 0)
    .sort((a, b) => a.margin - b.margin);
}

export type BracketMargin = {
  label: string;
  count: number;
  fees: number;
  costs: number;
  margin: number;
};

/** Marge des courses par tranche de distance du barème, dans l'ordre des
 * tranches (les tranches sans course sont omises). */
export function marginByBracket(margins: DeliveryMargin[], p: DeliveryPricing): BracketMargin[] {
  const labels = [
    ...p.brackets.map((b) => bracketLabel(b.upToKm, p)),
    bracketLabel(Number.POSITIVE_INFINITY, p),
  ];
  const rows = new Map<string, BracketMargin>(
    labels.map((label) => [label, { label, count: 0, fees: 0, costs: 0, margin: 0 }]),
  );
  for (const d of margins) {
    const row = rows.get(bracketLabel(d.mission.distanceKm, p));
    if (!row) continue;
    row.count++;
    row.fees += d.fee;
    row.costs += d.cost;
    row.margin += d.margin;
  }
  return [...rows.values()].filter((r) => r.count > 0);
}
