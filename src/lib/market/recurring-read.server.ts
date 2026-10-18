import { asc, desc, eq, inArray } from "drizzle-orm";
import { orders, recurringOrderEvents, recurringOrders } from "@/db/schema";
import type {
  PaymentMethod,
  RecurringOrder,
  RecurringOrderException,
  RecurringOrderItem,
} from "@/data/mocks";
import type { Q } from "./market-common.server";

// Commandes récurrentes du restaurant, telles que ses écrans les affichent
// (module sans dépendance vers la prise de commande, lu par l'instantané).

const METHOD: Record<string, PaymentMethod> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  cash: "Espèces",
};

export async function readRecurringOrders(q: Q, restaurantId: string): Promise<RecurringOrder[]> {
  const rows = await q
    .select()
    .from(recurringOrders)
    .where(eq(recurringOrders.restaurantId, restaurantId))
    .orderBy(desc(recurringOrders.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const events = await q
    .select()
    .from(recurringOrderEvents)
    .where(inArray(recurringOrderEvents.recurringOrderId, ids))
    .orderBy(asc(recurringOrderEvents.at));
  const generated = await q
    .select({ id: orders.id, recurringOrderId: orders.recurringOrderId })
    .from(orders)
    .where(inArray(orders.recurringOrderId, ids))
    .orderBy(asc(orders.createdAt));
  return rows.map((r) => ({
    id: r.id,
    restaurantId: r.restaurantId,
    name: r.name,
    farmerId: r.farmerId,
    items: r.items as RecurringOrderItem[],
    frequency: r.frequency as RecurringOrder["frequency"],
    intervalDays: r.intervalDays ?? undefined,
    daysOfWeek: r.daysOfWeek as number[],
    createTime: r.orderTime,
    deliverySlot: r.deliveryTime,
    firstRunAt: `${r.firstDeliveryOn}T00:00:00.000Z`,
    end: r.endRule as RecurringOrder["end"],
    rules: r.rules as RecurringOrder["rules"],
    deliveryAddress: r.deliveryAddress,
    deliveryMode: "standard",
    instructions: r.instructions ?? undefined,
    paymentMethod: METHOD[r.paymentMethod] ?? "Wave",
    status: r.status,
    pauseReason: r.pauseReason ?? undefined,
    pausedUntil: r.pausedUntil?.toISOString(),
    nextRunAt: r.nextRunAt?.toISOString() ?? null,
    nextDeliveryOn: r.nextDeliveryOn ?? undefined,
    generatedOrderIds: generated.filter((g) => g.recurringOrderId === r.id).map((g) => g.id),
    exceptions: r.exceptions as RecurringOrderException[],
    history: events
      .filter((e) => e.recurringOrderId === r.id)
      .map((e) => ({
        id: e.id,
        at: e.at.toISOString(),
        kind: e.kind as RecurringOrder["history"][number]["kind"],
        message: e.message,
      })),
    pendingAction: (r.pendingAction as RecurringOrder["pendingAction"]) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
