import { describe, expect, it } from "vitest";
import { isListed, minOrderOf, productOrderability } from "./product-availability";
import type { Product } from "@/data/mocks";

const base = { status: "active", stock: 10 } as Product;

describe("disponibilité d'un produit", () => {
  it("bloque brouillon, hors saison, date future et rupture", () => {
    expect(productOrderability(base).ok).toBe(true);
    expect(productOrderability({ ...base, status: "draft" }).ok).toBe(false);
    expect(productOrderability({ ...base, paused: true }).ok).toBe(false);
    expect(productOrderability({ ...base, availableFrom: "2999-01-01" }).ok).toBe(false);
    expect(productOrderability({ ...base, stock: 0 }).ok).toBe(false);
  });
  it("masque du catalogue les brouillons et les produits hors saison", () => {
    expect(isListed(base)).toBe(true);
    expect(isListed({ ...base, paused: true })).toBe(false);
  });
  it("applique la commande minimum", () => {
    expect(minOrderOf(base)).toBe(1);
    expect(minOrderOf({ ...base, minOrder: 5 })).toBe(5);
  });
});
