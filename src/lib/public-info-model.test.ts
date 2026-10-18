import { describe, expect, it } from "vitest";
import {
  commissionExplanation,
  commissionRange,
  paymentMethodsText,
  telLink,
  whatsappLink,
} from "./public-info-model";

describe("informations du site public", () => {
  const tiers = [
    { rate: 15, min: 0, max: 250_000 },
    { rate: 10, min: 250_000, max: 1_500_000 },
    { rate: 5, min: 1_500_000, max: null },
  ];

  it("commission tirée des paliers réglés", () => {
    expect(commissionRange(tiers)).toBe("5 – 15 %");
    expect(commissionRange([{ rate: 12, min: 0, max: null }])).toBe("12 %");
    expect(commissionExplanation(tiers)).toMatch(/15 % jusqu'à 250\s000 F CFA/);
    expect(commissionExplanation(tiers)).toMatch(/5 % au-delà de 1\s500\s000 F CFA/);
    expect(commissionExplanation([{ rate: 12, min: 0, max: null }])).toMatch(/taux unique de 12 %/);
  });

  it("liens de contact seulement pour un numéro plausible", () => {
    expect(whatsappLink("77 123 45 67")).toBe("https://wa.me/221771234567");
    expect(whatsappLink("+221 77 123 45 67", "Bonjour")).toBe(
      "https://wa.me/221771234567?text=Bonjour",
    );
    expect(whatsappLink("")).toBeNull();
    expect(telLink("+221 77 123 45 67")).toBe("tel:+221771234567");
    expect(telLink("12")).toBeNull();
  });

  it("moyens de paiement annoncés = ceux ouverts par l'admin", () => {
    expect(paymentMethodsText({ wave: true, orangeMoney: true, cash: true })).toBe(
      "par Wave, Orange Money ou en espèces à la livraison",
    );
    expect(paymentMethodsText({ wave: true, orangeMoney: true, cash: false })).toBe(
      "par Wave ou Orange Money",
    );
    expect(paymentMethodsText({ wave: false, orangeMoney: false, cash: true })).toBe(
      "en espèces à la livraison",
    );
    expect(paymentMethodsText({ wave: true, orangeMoney: false, cash: false })).toBe("par Wave");
  });
});
