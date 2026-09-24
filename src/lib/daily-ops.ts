import type { Mission, RestaurantOrder, Transaction } from "@/data/mocks";
import { DRIVER_COMMISSION_RATE } from "@/lib/commission";
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

// Une livraison est à l'heure si elle arrive au plus tard 4 h après le début
// du créneau choisi (la durée d'un créneau de réception).
export const ON_TIME_WINDOW_MS = 4 * 3600_000;

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
    (s, m) => s + Math.round(m.payout * (DRIVER_COMMISSION_RATE / 100)),
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
