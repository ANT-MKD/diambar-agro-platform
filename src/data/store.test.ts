import { describe, expect, it } from "vitest";
import { act, renderHook } from "../test-utils/render-hook";
import { useRefunds } from "./finance";
import {
  useDriverMissions,
  useDriverWallet,
  useFarmerNotifications,
  useMissions,
  useOrders,
  useProducts,
  useRestaurantNotifications,
  useRestaurantOrders,
  useTransactions,
  missionActions,
  missionPayout,
  MISSION_PAY,
  stockShortages,
  docRenewalActions,
  useDocRenewals,
  useDriverVehicle,
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

    const created = restaurantOrders.result.current.find((o) => o.id === id)!;
    expect(created.paid).toBe(false);
    expect(created.paidAt).toBeUndefined();

    walkOrder(created.reference, "loaded");
    expect(restaurantOrders.result.current.find((o) => o.id === id)?.paid).toBe(false);

    walkOrder(created.reference, "delivered");
    const settled = restaurantOrders.result.current.find((o) => o.id === id);
    expect(settled?.status).toBe("delivered");
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
      orderActions.setStatus(farmerOrder.id, "confirmed");
    });

    const updatedRestaurantOrder = restaurantOrders.result.current.find(
      (o) => o.reference === created.reference,
    );
    expect(updatedRestaurantOrder?.status).toBe("confirmed");
    expect(restaurantNotifs.result.current[0]).toMatchObject({
      type: "order",
      title: "Commande confirmée",
    });
  });

  it("does not notify the restaurant of its own cancellation", () => {
    const created = createBridgedOrder();
    const restaurantNotifs = renderHook(() => useRestaurantNotifications());
    const before = restaurantNotifs.result.current.length;

    act(() => {
      restaurantOrderActions.cancel(created.id, "Commande en double");
    });

    const added = restaurantNotifs.result.current
      .slice(0, restaurantNotifs.result.current.length - before)
      .map((n) => n.title);
    expect(added).not.toContain("Commande annulée");
  });
});

describe("cycle de vie commande ↔ mission", () => {
  function newOrder(paymentMethod: "Wave" | "Espèces" = "Wave", qty = 2) {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 20)!;
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty, price: target.pricePerKg }],
        total: target.pricePerKg * qty,
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMethod,
      });
    });
    const order = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    return { order, product: target };
  }

  it("n'ouvre la mission aux livreurs qu'après la confirmation du producteur", () => {
    const { order } = newOrder();
    const missions = renderHook(() => useMissions());
    expect(missions.result.current.some((m) => m.orderRef === order.reference)).toBe(false);

    walkOrder(order.reference, "confirmed");
    const mission = missions.result.current.find((m) => m.orderRef === order.reference);
    expect(mission?.status).toBe("available");
    expect(mission?.payout).toBeGreaterThanOrEqual(1500);
  });

  it("met la commande en livraison à l'enlèvement et ne paie qu'une seule fois", () => {
    const { order } = newOrder();
    const restaurantOrders = renderHook(() => useRestaurantOrders());
    const txs = renderHook(() => useTransactions());
    const wallet = renderHook(() => useDriverWallet());

    const mission = walkOrder(order.reference, "loaded");
    expect(restaurantOrders.result.current.find((o) => o.id === order.id)?.status).toBe(
      "delivering",
    );

    walkOrder(order.reference, "delivered");
    const walletCount = wallet.result.current.transactions.length;
    const credited = () => txs.result.current.filter((t) => t.orderRef === order.reference);
    expect(credited()).toHaveLength(1);

    // Rejouer la livraison (double clic, tournée…) ne paie plus rien.
    let replay!: ReturnType<typeof missionActions.setStatus>;
    act(() => {
      replay = missionActions.setStatus(mission.id, "delivered");
    });
    expect(replay.ok).toBe(false);
    expect(credited()).toHaveLength(1);
    expect(wallet.result.current.transactions.length).toBe(walletCount);
  });

  it("réserve « Livrée » au livreur", () => {
    const { order } = newOrder();
    const orders = renderHook(() => useOrders());
    walkOrder(order.reference, "confirmed");
    const farmerOrder = orders.result.current.find((o) => o.reference === order.reference)!;

    let byFarmer!: ReturnType<typeof orderActions.setStatus>;
    let byRestaurant!: ReturnType<typeof restaurantOrderActions.setStatus>;
    act(() => {
      byFarmer = orderActions.setStatus(farmerOrder.id, "delivered");
      byRestaurant = restaurantOrderActions.setStatus(order.id, "delivered");
    });
    expect(byFarmer.ok).toBe(false);
    expect(byRestaurant.ok).toBe(false);
  });

  it("ne revient jamais en arrière", () => {
    const { order } = newOrder();
    const orders = renderHook(() => useOrders());
    walkOrder(order.reference, "preparing");
    const farmerOrder = orders.result.current.find((o) => o.reference === order.reference)!;
    let back!: ReturnType<typeof orderActions.setStatus>;
    act(() => {
      back = orderActions.setStatus(farmerOrder.id, "confirmed");
    });
    expect(back.ok).toBe(false);
  });

  it("n'accepte que le livreur attribué pour faire avancer la mission", () => {
    const { order } = newOrder();
    const mission = walkOrder(order.reference, "accepted");
    let other!: ReturnType<typeof missionActions.setStatus>;
    act(() => {
      other = missionActions.setStatus(mission.id, "loaded", "d2");
    });
    expect(other.ok).toBe(false);
  });

  it("annulation : stock remis, mission retirée, restaurant remboursé", () => {
    const { order, product } = newOrder("Wave", 3);
    const products = renderHook(() => useProducts());
    const missions = renderHook(() => useMissions());
    const refunds = renderHook(() => useRefunds());
    const stockAfterOrder = products.result.current.find((p) => p.id === product.id)!.stock;

    walkOrder(order.reference, "confirmed");
    let result!: ReturnType<typeof restaurantOrderActions.cancel>;
    act(() => {
      result = restaurantOrderActions.cancel(order.id, "Menu modifié");
    });
    expect(result.ok).toBe(true);
    expect(products.result.current.find((p) => p.id === product.id)!.stock).toBe(
      stockAfterOrder + 3,
    );
    expect(missions.result.current.find((m) => m.orderRef === order.reference)?.status).toBe(
      "cancelled",
    );
    const refund = refunds.result.current.find((r) => r.orderRef === order.reference);
    expect(refund).toMatchObject({ source: "cancellation", amount: order.total });
  });

  it("le restaurant ne peut plus annuler une fois la préparation commencée", () => {
    const { order } = newOrder();
    walkOrder(order.reference, "preparing");
    let result!: ReturnType<typeof restaurantOrderActions.cancel>;
    act(() => {
      result = restaurantOrderActions.cancel(order.id, "Trop tard ?");
    });
    expect(result.ok).toBe(false);
  });

  it("une commande enlevée ne peut plus être annulée", () => {
    const { order } = newOrder();
    const orders = renderHook(() => useOrders());
    walkOrder(order.reference, "loaded");
    const farmerOrder = orders.result.current.find((o) => o.reference === order.reference)!;
    let result!: ReturnType<typeof orderActions.setStatus>;
    act(() => {
      result = orderActions.setStatus(farmerOrder.id, "cancelled", "test");
    });
    expect(result.ok).toBe(false);
  });
});

const PHOTO = {
  id: "ph1",
  name: "livraison.jpg",
  size: 1000,
  mime: "image/jpeg",
  at: "2026-01-01T00:00:00Z",
};

/**
 * Fait avancer une commande créée par un restaurant jusqu'à une étape donnée,
 * en respectant qui fait quoi : le producteur confirme puis prépare, le
 * livreur d1 accepte, enlève puis livre. Renvoie la mission.
 */
function walkOrder(
  reference: string,
  until: "confirmed" | "preparing" | "accepted" | "loaded" | "delivered",
) {
  const orders = renderHook(() => useOrders());
  const missions = renderHook(() => useMissions());
  const farmerOrder = orders.result.current.find((o) => o.reference === reference)!;
  const steps = ["confirmed", "preparing", "accepted", "loaded", "delivered"] as const;
  const upto = steps.indexOf(until);
  const status = () => orders.result.current.find((o) => o.reference === reference)!.status;
  act(() => {
    if (status() === "pending") orderActions.setStatus(farmerOrder.id, "confirmed");
  });
  if (upto >= 1) {
    act(() => {
      if (status() === "confirmed") orderActions.setStatus(farmerOrder.id, "preparing");
    });
  }
  const mission = () => missions.result.current.find((m) => m.orderRef === reference)!;
  if (upto >= 2) {
    act(() => {
      if (mission().status === "available") missionActions.accept(mission().id, "d1");
    });
  }
  const pickupCode = orders.result.current.find((o) => o.reference === reference)!.pickupCode;
  const deliveryCode = renderHook(() => useRestaurantOrders()).result.current.find(
    (o) => o.reference === reference,
  )?.deliveryCode;
  if (upto >= 3) {
    act(() => {
      if (mission().status !== "loaded" && mission().status !== "delivered") {
        missionActions.setStatus(mission().id, "loaded", "d1", { code: pickupCode });
      }
    });
  }
  if (upto >= 4) {
    act(() => {
      if (mission().status === "loaded") {
        missionActions.attachProof(mission().id, [PHOTO]);
        missionActions.setStatus(mission().id, "delivered", "d1", { code: deliveryCode });
      }
    });
  }
  return mission();
}

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
      missionActions.attachProof(mission.id, [PHOTO]);
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
      missionActions.setStatus(mission.id, "loaded");
      missionActions.attachProof(mission.id, [PHOTO]);
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

describe("missionActions.dismiss (refus d'une mission par un livreur)", () => {
  it("hides the mission for this driver only, and keeps it open for the others", () => {
    const all = renderHook(() => useMissions());
    const mine = renderHook(() => useDriverMissions());
    const mission = all.result.current.find((m) => m.reference === "MIS-4212")!;
    expect(mission.status).toBe("available");

    act(() => {
      missionActions.dismiss(mission.id);
    });

    expect(mine.result.current.some((m) => m.id === mission.id)).toBe(false);
    expect(all.result.current.find((m) => m.id === mission.id)?.status).toBe("available");
  });
});

describe("missionActions.withdraw (désistement du livreur)", () => {
  it("puts an accepted mission back in the pool with the reason, and hides it for this driver", () => {
    const all = renderHook(() => useMissions());
    const mine = renderHook(() => useDriverMissions());
    const mission = all.result.current.find((m) => m.reference === "MIS-4211")!;
    act(() => {
      missionActions.accept(mission.id, "d1");
    });

    let result!: ReturnType<typeof missionActions.withdraw>;
    act(() => {
      result = missionActions.withdraw(mission.id, "Panne du véhicule");
    });

    expect(result.ok).toBe(true);
    const after = all.result.current.find((m) => m.id === mission.id)!;
    expect(after.status).toBe("available");
    expect(after.driverId).toBeUndefined();
    expect(after.statusHistory?.at(-1)?.note).toContain("Panne du véhicule");
    expect(mine.result.current.some((m) => m.id === mission.id)).toBe(false);
  });

  it("refuses once the goods are loaded", () => {
    const all = renderHook(() => useMissions());
    const loaded = all.result.current.find((m) => m.reference === "MIS-4220")!;
    expect(loaded.status).toBe("loaded");
    const result = missionActions.withdraw(loaded.id, "Trop tard", loaded.driverId);
    expect(result.ok).toBe(false);
  });
});

describe("lot B — montants", () => {
  it("paie le producteur sur la marchandise seule, frais et remises à part", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 20)!;
    const orders = renderHook(() => useOrders());
    const txs = renderHook(() => useTransactions());
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 4, price: target.pricePerKg }],
        subtotal: target.pricePerKg * 4,
        deliveryFee: 1000,
        promoDiscount: 300,
        total: target.pricePerKg * 4 + 1000 - 300,
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMethod: "Wave",
      });
    });
    const resto = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    const farmerOrder = orders.result.current.find((o) => o.reference === resto.reference)!;
    expect(farmerOrder.total).toBe(target.pricePerKg * 4);

    walkOrder(resto.reference, "delivered");
    const tx = txs.result.current.find((t) => t.orderRef === resto.reference)!;
    expect(tx.gross).toBe(target.pricePerKg * 4);
  });

  it("signale un stock insuffisant au moment de payer", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 0)!;
    expect(stockShortages([{ productId: target.id, qty: target.stock + 1 }])).toHaveLength(1);
    expect(stockShortages([{ productId: target.id, qty: target.stock }])).toHaveLength(0);
  });

  it("calcule la course du livreur avec la distance et le poids, jamais sous le minimum", () => {
    expect(missionPayout(1, 1)).toBe(MISSION_PAY.minimum);
    expect(missionPayout(70, 50)).toBeGreaterThan(missionPayout(70, 10));
  });
});

describe("preuves de remise", () => {
  it("refuse l'enlèvement sans le code du producteur et la livraison sans code ni photo", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 20)!;
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 1, price: target.pricePerKg }],
        total: target.pricePerKg,
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMethod: "Wave",
      });
    });
    const resto = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    const mission = walkOrder(resto.reference, "accepted");

    let r!: ReturnType<typeof missionActions.setStatus>;
    act(() => {
      r = missionActions.setStatus(mission.id, "loaded", "d1", { code: "0000" });
    });
    expect(r.ok).toBe(false);

    walkOrder(resto.reference, "loaded");
    act(() => {
      r = missionActions.setStatus(mission.id, "delivered", "d1", { code: resto.deliveryCode });
    });
    expect(r.ok).toBe(false); // pas de photo
    act(() => {
      missionActions.attachProof(mission.id, [PHOTO]);
      r = missionActions.setStatus(mission.id, "delivered", "d1", { code: "9999" });
    });
    expect(r.ok).toBe(false); // mauvais code
    act(() => {
      r = missionActions.setStatus(mission.id, "delivered", "d1", { code: resto.deliveryCode });
    });
    expect(r.ok).toBe(true);
  });
});

describe("contrôle à la réception", () => {
  it("rembourse automatiquement les quantités refusées, une seule fois", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 20)!;
    const refunds = renderHook(() => useRefunds());
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 5, price: target.pricePerKg }],
        total: target.pricePerKg * 5,
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMethod: "Wave",
      });
    });
    const resto = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    walkOrder(resto.reference, "delivered");
    let r!: ReturnType<typeof restaurantOrderActions.reportReception>;
    act(() => {
      r = restaurantOrderActions.reportReception(id, [
        { productId: target.id, refusedQty: 9, reason: "Abîmé" },
      ]);
    });
    expect(r.ok).toBe(true);
    const refund = refunds.result.current.find(
      (x) => x.orderRef === resto.reference && x.source === "reception",
    );
    // Plafonné à la quantité livrée (5), jamais 9.
    expect(refund?.amount).toBe(target.pricePerKg * 5);
    act(() => {
      r = restaurantOrderActions.reportReception(id, []);
    });
    expect(r.ok).toBe(false);
  });
});

describe("confirmation partielle", () => {
  it("réduit la commande, remet le stock et rembourse la différence", () => {
    const products = renderHook(() => useProducts());
    const target = products.result.current.find((p) => p.stock > 20)!;
    const refunds = renderHook(() => useRefunds());
    let id = "";
    act(() => {
      id = restaurantOrderActions.create({
        farmerId: target.farmerId,
        items: [{ productId: target.id, qty: 10, price: target.pricePerKg }],
        subtotal: target.pricePerKg * 10,
        total: target.pricePerKg * 10,
        deliveryAddress: "Le Baobab, Dakar Plateau",
        paymentMethod: "Wave",
        shortagePreference: "partial",
      });
    });
    const orders = renderHook(() => useOrders());
    const resto = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    const fo = orders.result.current.find((o) => o.reference === resto.reference)!;
    const stockBefore = products.result.current.find((p) => p.id === target.id)!.stock;
    let r!: ReturnType<typeof orderActions.confirmPartial>;
    act(() => {
      r = orderActions.confirmPartial(fo.id, { [target.id]: 6 });
    });
    expect(r.ok).toBe(true);
    const after = renderHook(() => useRestaurantOrders()).result.current.find((o) => o.id === id)!;
    expect(after.status).toBe("confirmed");
    expect(after.items[0].qty).toBe(6);
    expect(after.total).toBe(target.pricePerKg * 6);
    expect(products.result.current.find((p) => p.id === target.id)!.stock).toBe(stockBefore + 4);
    expect(
      refunds.result.current.find((x) => x.orderRef === resto.reference && x.source === "shortage")
        ?.amount,
    ).toBe(target.pricePerKg * 4);
  });
});

describe("renouvellement des documents du livreur", () => {
  it("met à jour l'échéance seulement après validation par l'admin", () => {
    const vehicle = renderHook(() => useDriverVehicle());
    const before = vehicle.result.current.insuranceExpiry;
    const next = "2030-01-01";
    let r!: ReturnType<typeof docRenewalActions.submit>;
    act(() => {
      r = docRenewalActions.submit({ doc: "insurance", newExpiry: next, photos: [] });
    });
    expect(r.ok).toBe(false); // photo obligatoire
    act(() => {
      docRenewalActions.submit({ doc: "insurance", newExpiry: next, photos: [PHOTO] });
    });
    expect(vehicle.result.current.insuranceExpiry).toBe(before);
    const pending = renderHook(() => useDocRenewals()).result.current.find(
      (x) => x.status === "pending",
    )!;
    act(() => {
      docRenewalActions.approve(pending.id, "Admin test");
    });
    expect(vehicle.result.current.insuranceExpiry).toBe(next);
  });
});
