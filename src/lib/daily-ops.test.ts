import { describe, expect, it } from "vitest";
import { computeDailyOps } from "./daily-ops";
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
  slotStart: at(7),
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
    expect(ops.onTimeRate).toBe(0.5); // CMD-2 livrée 7 h après son créneau
    expect(ops.cashToReconcile).toBe(11000);
    // 3000 commissions + 2000 livraison + 1200 commissions livreur − 6000 courses
    expect(ops.margin.total).toBe(200);
    expect(ops.marginPerOrder).toBe(100);
  });
});
