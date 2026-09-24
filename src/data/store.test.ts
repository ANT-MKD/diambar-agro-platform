import { describe, expect, it } from "vitest";
import { act, renderHook } from "../test-utils/render-hook";
import {
  useDriverWallet,
  useFarmerNotifications,
  useMissions,
  useOrders,
  useProducts,
  useRestaurantNotifications,
  useRestaurantOrders,
  missionActions,
  orderActions,
  restaurantOrderActions,
} from "./store";

// These exercise the Phase 3 order bridge: a restaurant order created via
// checkout used to be invisible to the farmer (two disconnected stores).
// Each test creates its own order (unique farmerId-independent items) so
// tests stay independent despite the underlying stores being module-level
// singletons shared across the whole file.

describe("restaurantOrderActions.create (order bridge)", () => {
  it("creates a matching farmer order, deducts stock, and notifies the farmer", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current[0];

    const orders = renderHook(() => useOrders());
    const restaurantOrders = renderHook(() => useRestaurantOrders());
    const farmerNotifs = renderHook(() => useFarmerNotifications());

    let newId = "";
    act(() => {
      newId = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 3, price: target.pricePerKg }],
        total: target.pricePerKg * 3,
        deliveryAddress: "Chez Test, Test City",
        paymentMethod: "Wave",
      });
    });

    const createdRestaurantOrder = restaurantOrders.result.current.find((o) => o.id === newId);
    expect(createdRestaurantOrder).toBeTruthy();
    expect(createdRestaurantOrder?.status).toBe("pending");

    const bridgedFarmerOrder = orders.result.current.find(
      (o) => o.reference === createdRestaurantOrder?.reference,
    );
    expect(bridgedFarmerOrder).toBeTruthy();
    expect(bridgedFarmerOrder?.farmerId).toBe(target.farmerId);
    expect(bridgedFarmerOrder?.total).toBe(target.pricePerKg * 3);
    expect(bridgedFarmerOrder?.status).toBe("pending");

    const updatedProduct = products.result.current.find((p) => p.id === target.id);
    expect(updatedProduct?.stock).toBe(target.stock - 3);

    expect(farmerNotifs.result.current[0]).toMatchObject({
      type: "order",
      title: "Nouvelle commande",
    });
    expect(farmerNotifs.result.current[0].body).toContain(createdRestaurantOrder?.reference);
  });
});

describe("restaurantOrderActions.create / setStatus (paiement à la commande vs à la livraison)", () => {
  it("marks a Wave order paid immediately, simulating an instant gateway confirmation", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current[1];
    const restaurantOrders = renderHook(() => useRestaurantOrders());

    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 1, price: target.pricePerKg }],
        total: target.pricePerKg,
        deliveryAddress: "Chez Test Wave, Test City",
        paymentMethod: "Wave",
      });
    });

    const created = restaurantOrders.result.current.find((o) => o.id === id);
    expect(created?.paid).toBe(true);
    expect(created?.paidAt).toBeTruthy();
  });

  it("keeps a cash order unpaid until it is genuinely delivered, then settles it", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current[1];
    const restaurantOrders = renderHook(() => useRestaurantOrders());

    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 1, price: target.pricePerKg }],
        total: target.pricePerKg,
        deliveryAddress: "Chez Test Especes, Test City",
        paymentMethod: "Espèces",
      });
    });

    const created = restaurantOrders.result.current.find((o) => o.id === id);
    expect(created?.paid).toBe(false);
    expect(created?.paidAt).toBeUndefined();

    act(() => {
      restaurantOrderActions.setStatus(id, "preparing");
    });
    const stillUnpaid = restaurantOrders.result.current.find((o) => o.id === id);
    expect(stillUnpaid?.paid).toBe(false);

    act(() => {
      restaurantOrderActions.setStatus(id, "delivered");
    });
    const settled = restaurantOrders.result.current.find((o) => o.id === id);
    expect(settled?.paid).toBe(true);
    expect(settled?.paidAt).toBeTruthy();
  });

  it("also settles a cash order when delivered is propagated from the farmer side", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current[1];
    const orders = renderHook(() => useOrders());
    const restaurantOrders = renderHook(() => useRestaurantOrders());

    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 1, price: target.pricePerKg }],
        total: target.pricePerKg,
        deliveryAddress: "Chez Test Especes 2, Test City",
        paymentMethod: "Espèces",
      });
    });
    const created = restaurantOrders.result.current.find((o) => o.id === id)!;
    const farmerOrder = orders.result.current.find((o) => o.reference === created.reference)!;

    act(() => {
      orderActions.setStatus(farmerOrder.id, "delivered");
    });

    const settled = restaurantOrders.result.current.find((o) => o.id === id);
    expect(settled?.paid).toBe(true);
    expect(settled?.paidAt).toBeTruthy();
  });
});

describe("orderActions.setStatus (farmer -> restaurant propagation)", () => {
  function createBridgedOrder() {
    const products = renderHook(() => useProducts());
    const target = products.result.current[0];
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 1, price: target.pricePerKg }],
        total: target.pricePerKg,
        deliveryAddress: "Chez Test 2, Test City",
        paymentMethod: "Wave",
      });
    });
    const restaurantOrders = renderHook(() => useRestaurantOrders());
    return restaurantOrders.result.current.find((o) => o.id === id)!;
  }

  it("mirrors a status change onto the matching restaurant order and notifies the restaurant", () => {
    const created = createBridgedOrder();
    const orders = renderHook(() => useOrders());
    const restaurantOrders = renderHook(() => useRestaurantOrders());
    const restaurantNotifs = renderHook(() => useRestaurantNotifications());

    const farmerOrder = orders.result.current.find((o) => o.reference === created.reference)!;

    act(() => {
      orderActions.setStatus(farmerOrder.id, "delivering");
    });

    const updatedRestaurantOrder = restaurantOrders.result.current.find(
      (o) => o.reference === created.reference,
    );
    expect(updatedRestaurantOrder?.status).toBe("delivering");
    expect(restaurantNotifs.result.current[0]).toMatchObject({
      type: "order",
      title: "Livraison en route",
    });
  });

  it("does not push a notification for a status with no mapped message", () => {
    const created = createBridgedOrder();
    const orders = renderHook(() => useOrders());
    const restaurantNotifs = renderHook(() => useRestaurantNotifications());
    const before = restaurantNotifs.result.current.length;

    const farmerOrder = orders.result.current.find((o) => o.reference === created.reference)!;
    act(() => {
      orderActions.setStatus(farmerOrder.id, "preparing");
    });

    expect(restaurantNotifs.result.current.length).toBe(before);
  });
});

describe("missionActions.setStatus (delivery cascade)", () => {
  it("marks the linked order delivered when the mission reaches 'delivered'", () => {
    // Seed data links mission mi4 (reference MIS-4200) to order o1 via
    // orderRef "CMD-2851" -- this is the one pairing that exists in the
    // seed data, so this test intentionally relies on it rather than
    // creating a fresh mission (missionActions has no create()).
    const missions = renderHook(() => useMissions());
    const orders = renderHook(() => useOrders());
    const mission = missions.result.current.find((m) => m.reference === "MIS-4200")!;
    expect(mission).toBeTruthy();

    act(() => {
      missionActions.setStatus(mission.id, "delivered");
    });

    const linkedOrder = orders.result.current.find((o) => o.reference === mission.orderRef);
    expect(linkedOrder?.status).toBe("delivered");
  });

  it("credits the driver wallet with the payout minus the 20% platform commission", () => {
    const missions = renderHook(() => useMissions());
    const wallet = renderHook(() => useDriverWallet());
    const mission = missions.result.current.find((m) => m.reference === "MIS-4201")!;
    expect(mission).toBeTruthy();
    const balanceBefore = wallet.result.current.balance;

    act(() => {
      missionActions.setStatus(mission.id, "delivered");
    });

    const expectedCommission = Math.round(mission.payout * 0.2);
    const txs = wallet.result.current.transactions.filter((t) => t.ref === mission.reference);
    expect(txs.find((t) => t.kind === "mission")?.amount).toBe(mission.payout);
    expect(txs.find((t) => t.kind === "commission")?.amount).toBe(-expectedCommission);
    expect(wallet.result.current.balance).toBe(balanceBefore + mission.payout - expectedCommission);
  });
});

describe("missionActions.accept (first come, first served)", () => {
  it("refuses a mission another driver has just taken", () => {
    const missions = renderHook(() => useMissions());
    const mission = missions.result.current.find((m) => m.reference === "MIS-4210")!;
    expect(mission.status).toBe("available");

    let first!: ReturnType<typeof missionActions.accept>;
    let second!: ReturnType<typeof missionActions.accept>;
    act(() => {
      first = missionActions.accept(mission.id, "d1");
      second = missionActions.accept(mission.id, "d2");
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("taken");
    const after = missions.result.current.find((m) => m.id === mission.id);
    expect(after?.driverId).toBe("d1");
  });
});
