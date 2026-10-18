import { describe, expect, it } from "vitest";
import {
  computeDailyOps,
  deliveryMargins,
  lossMakingDeliveries,
  marginByBracket,
} from "./daily-ops";
import { DEFAULT_DELIVERY_PRICING } from "./delivery-pricing";
import type { Mission, RestaurantOrder, Transaction } from "@/data/mocks";

const day = new Date(2026, 8, 30, 12);
const at = (h: number) => new Date(2026, 8, 30, h).toISOString();

const order = (over: Partial<RestaurantOrder>): RestaurantOrder => ({
  id: "ro",
  reference: "CMD-1",
  farmerId: "f1",
  items: [{ productId: "p1", qty: 10, price: 1000 }],
  subtotal: 10000,
  deliveryFee: 1000,
  total: 11000,
  status: "delivered",
  createdAt: at(6),
  deliveryAddress: "Dakar",
  paymentMethod: "Wave",
  statusHistory: [
    { status: "pending", at: at(6) },
    { status: "delivered", at: at(9) },
  ],
  paid: true,
  slotStart: at(8),
  ...over,
});

describe("opérations du jour", () => {
  it("calcule service, ponctualité, espèces et marge", () => {
    const ops = computeDailyOps({
      day,
      restaurantOrders: [
        order({
          reception: {
            at: at(10),
            lines: [{ productId: "p1", refusedQty: 2, reason: "x" }],
            refundedAmount: 2000,
          },
        }),
        order({ id: "ro2", reference: "CMD-2", paymentMethod: "Espèces", slotStart: at(2) }),
      ],
      missions: [
        { id: "m1", orderRef: "CMD-1", status: "delivered", payout: 3000 } as Mission,
        { id: "m2", orderRef: "CMD-2", status: "delivered", payout: 3000 } as Mission,
      ],
      transactions: [
        { orderRef: "CMD-1", commission: 1500 } as Transaction,
        { orderRef: "CMD-2", commission: 1500 } as Transaction,
      ],
      disputes: [{ openedAt: at(11) }],
      refunds: [],
    });
    expect(ops.delivered).toBe(2);
    expect(ops.serviceRate).toBeCloseTo(18 / 20);
    expect(ops.onTimeRate).toBe(0.5); // CMD-2 livrée 7 h après l'heure choisie
    expect(ops.cashToReconcile).toBe(11000);
    // 3000 commissions + 2000 livraison + 1200 commissions livreur − 6000 courses
    expect(ops.margin.total).toBe(200);
    expect(ops.marginPerOrder).toBe(100);
  });
});

describe("livraisons à perte", () => {
  const day = new Date("2026-10-12T12:00:00Z");
  const mission = (id: string, orderRef: string, payout: number, over: Partial<Mission> = {}) =>
    ({
      id,
      reference: `MIS-${id}`,
      orderRef,
      status: "available",
      payout,
      scheduledFor: "2026-10-12T07:00:00Z",
      distanceKm: 30,
      weightKg: 40,
      pickup: { city: "Thiès" },
      dropoff: { city: "Dakar" },
      ...over,
    }) as unknown as Mission;
  const ro = (reference: string, deliveryFee: number) =>
    ({
      id: reference,
      reference,
      items: [],
      total: 10_000 + deliveryFee,
      subtotal: 10_000,
      deliveryFee,
      status: "confirmed",
      statusHistory: [],
      createdAt: "2026-10-11T10:00:00Z",
    }) as unknown as RestaurantOrder;

  it("liste les courses dont le coût net dépasse les frais payés", () => {
    const losses = lossMakingDeliveries({
      day,
      restaurantOrders: [ro("CMD-1", 1500), ro("CMD-2", 3000), ro("CMD-3", 1000)],
      missions: [
        // 4 000 − 20 % = 3 200 de coût pour 1 500 payés : −1 700.
        mission("1", "CMD-1", 4000),
        // 3 000 − 20 % = 2 400 pour 3 000 payés : rentable.
        mission("2", "CMD-2", 3000),
        // Annulée : ignorée.
        mission("3", "CMD-3", 5000, { status: "cancelled" }),
        // Autre jour : ignorée.
        mission("4", "CMD-3", 5000, { scheduledFor: "2026-10-14T07:00:00Z" }),
      ],
    });
    expect(losses.map((l) => [l.mission.reference, l.margin])).toEqual([["MIS-1", -1700]]);
  });

  it("regroupe la marge par tranche de distance", () => {
    const margins = deliveryMargins({
      day,
      restaurantOrders: [ro("CMD-1", 1500), ro("CMD-2", 2000), ro("CMD-3", 10_100)],
      missions: [
        mission("1", "CMD-1", 1500, { distanceKm: 3 }),
        mission("2", "CMD-2", 2000, { distanceKm: 8 }),
        mission("3", "CMD-3", 9900, { distanceKm: 74 }),
      ],
    });
    const rows = marginByBracket(margins, DEFAULT_DELIVERY_PRICING);
    expect(rows.map((r) => [r.label, r.count, r.margin])).toEqual([
      // 1 500 − (1 500 − 300)
      ["0 à 5 km", 1, 300],
      // 2 000 − (2 000 − 400)
      ["5 à 10 km", 1, 400],
      // 10 100 − (9 900 − 1 980)
      ["Plus de 40 km", 1, 2180],
    ]);
  });
});
