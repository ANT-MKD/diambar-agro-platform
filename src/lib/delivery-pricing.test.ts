import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_PRICING as P,
  deliveryFee,
  driverNetCost,
  estimateDistanceKm,
  normalizePricing,
} from "./delivery-pricing";
import { findPlace, REFERENCE_PLACES as R } from "./places";

describe("frais de livraison selon la distance", () => {
  it("tranches, au-delà de 40 km et poids", () => {
    expect(deliveryFee(3, 10, P).fee).toBe(1500);
    expect(deliveryFee(8, 10, P).fee).toBe(2000);
    expect(deliveryFee(15, 10, P).fee).toBe(3000);
    expect(deliveryFee(24, 10, P).fee).toBe(5000);
    // 74 km : 5 000 + 34 × 150.
    expect(deliveryFee(74, 10, P).fee).toBe(10100);
    // 50 kg : 30 kg au-delà de 20 × 10 F.
    expect(deliveryFee(3, 50, P).fee).toBe(1800);
  });

  it("chaque tranche couvre le coût de la course (sans garde-fou)", () => {
    const noFloor = { ...P, floorToCost: false };
    for (const km of [1, 5, 6, 10, 11, 20, 21, 40, 41, 74, 150]) {
      for (const kg of [5, 20, 60, 200]) {
        expect(deliveryFee(km, kg, noFloor).fee).toBeGreaterThanOrEqual(driverNetCost(km, kg));
      }
    }
  });

  it("garde-fou : un barème trop bas est relevé au coût de la course", () => {
    const cheap = normalizePricing({ brackets: [{ upToKm: 100, fee: 500 }] });
    const q = deliveryFee(60, 10, cheap);
    expect(q.floored).toBe(true);
    expect(q.fee).toBeGreaterThanOrEqual(driverNetCost(60, 10));
  });

  it("distances : Thiès → Plateau par la route, et dans Dakar", () => {
    expect(estimateDistanceKm(R["Thiès"], R.Plateau, 1.3)).toBeGreaterThan(65);
    expect(estimateDistanceKm(R["Thiès"], R.Plateau, 1.3)).toBeLessThan(85);
    expect(estimateDistanceKm(R["Médina"], R.Plateau, 1.3)).toBeLessThanOrEqual(5);
    expect(estimateDistanceKm(R.Plateau, R.Plateau, 1.3, 3)).toBe(3);
  });

  it("lieux : ville en fin d'adresse, quartier de Dakar, jamais inventé", () => {
    expect(findPlace("Route de Khombole, km 3, Thiès")?.name).toBe("Thiès");
    expect(findPlace("Keur Massar, Dakar")?.name).toBe("Keur Massar");
    expect(findPlace("Le Baobab, Dakar Plateau")?.name).toBe("Plateau");
    expect(findPlace("Quelque part, Ziguinchor")?.name).toBe("Ziguinchor");
    expect(findPlace("Village inconnu")).toBeNull();
    // Nom de quartier : « Dakar » seul ne situe rien de plus précis.
    expect(findPlace("Dakar Nord", R, { wide: false })).toBeNull();
    expect(findPlace("Dakar", R, { wide: false })?.name).toBe("Dakar");
    expect(findPlace("Parcelles Assainies Unité 15", R, { wide: false })?.name).toBe(
      "Parcelles Assainies",
    );
  });
});
