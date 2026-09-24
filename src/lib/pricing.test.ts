import { describe, expect, it } from "vitest";
import { allocate, orderAmounts, zoneForAddress } from "./pricing";

const zones = [
  { id: "dz1", name: "Dakar", baseFee: 1000, active: true },
  { id: "dz2", name: "Thiès", baseFee: 3500, active: true },
  { id: "dz4", name: "Saint-Louis", baseFee: 6000, active: false },
];

describe("zones de livraison", () => {
  it("trouve la zone par la ville, puis par l'adresse, sans tenir compte des accents", () => {
    expect(zoneForAddress(zones, "Dakar", "")?.id).toBe("dz1");
    expect(zoneForAddress(zones, undefined, "Le Baobab, Dakar Plateau")?.id).toBe("dz1");
    expect(zoneForAddress(zones, "thies", "")?.id).toBe("dz2");
    expect(zoneForAddress(zones, undefined, "Hôtel, Saint-Louis")?.active).toBe(false);
    expect(zoneForAddress(zones, "Kaolack", "Rue 12, Kaolack")).toBeNull();
  });
});

describe("répartition d'une remise", () => {
  it("répartit au prorata sans perdre ni créer un franc", () => {
    const parts = allocate(1000, [3000, 1000]);
    expect(parts).toEqual([750, 250]);
    const odd = allocate(1001, [1, 1, 1]);
    expect(odd.reduce((s, p) => s + p, 0)).toBe(1001);
  });
  it("ne répartit rien quand il n'y a rien à répartir", () => {
    expect(allocate(0, [10, 20])).toEqual([0, 0]);
    expect(allocate(500, [])).toEqual([]);
  });
});

describe("montants d'une commande", () => {
  it("reconstitue le détail d'une ancienne commande sans champs de montant", () => {
    expect(orderAmounts({ items: [{ qty: 2, price: 500 }], total: 1000 })).toEqual({
      subtotal: 1000,
      deliveryFee: 0,
      promoDiscount: 0,
      creditApplied: 0,
      total: 1000,
    });
  });
});
