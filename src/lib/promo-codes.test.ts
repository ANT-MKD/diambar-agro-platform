import { describe, expect, it } from "vitest";
import { computePromoDiscount, findPromoCode, type PromoCode } from "./promo-codes";

describe("findPromoCode", () => {
  it("finds a code regardless of case or surrounding whitespace", () => {
    expect(findPromoCode(" bienvenue10 ")?.code).toBe("BIENVENUE10");
  });

  it("returns undefined for an unknown code", () => {
    expect(findPromoCode("NOPE")).toBeUndefined();
  });
});

describe("computePromoDiscount", () => {
  const percentPromo = findPromoCode("BIENVENUE10")!;
  const freeDeliveryPromo = findPromoCode("FRAISGRATUIT")!;

  it("computes a percentage discount above the minimum", () => {
    expect(computePromoDiscount(percentPromo, 10_000, 300)).toBe(1_000);
  });

  it("returns 0 below the minimum subtotal", () => {
    expect(computePromoDiscount(percentPromo, 4_999, 300)).toBe(0);
  });

  it("refunds exactly the delivery fee for FRAISGRATUIT above its minimum", () => {
    expect(computePromoDiscount(freeDeliveryPromo, 30_000, 2_500)).toBe(2_500);
  });

  it("caps a generic fixed discount at the subtotal", () => {
    const genericFixed: PromoCode = {
      code: "GENERIC5000",
      label: "test",
      type: "fixed",
      value: 5_000,
    };
    expect(computePromoDiscount(genericFixed, 1_000, 2_500)).toBe(1_000);
  });
});
