import { describe, expect, it } from "vitest";
import { agoLabel, estimateMinutes } from "./live-eta";

describe("estimation de durée", () => {
  const dakar = { lat: 14.6681, lng: -17.4377 };
  it("en ville : vitesse urbaine", () => {
    // ~3 km à vol d'oiseau → ~3,9 km de route à 20 km/h.
    expect(estimateMinutes(dakar, { lat: 14.6951, lng: -17.4377 })).toBe(12);
  });
  it("entre deux villes : vitesse sur route au-delà des premiers kilomètres", () => {
    // Dakar → Thiès (~55 km à vol d'oiseau) : autour d'1 h 40, pas 3 h.
    const min = estimateMinutes(dakar, { lat: 14.7886, lng: -16.926 });
    expect(min).toBeGreaterThan(80);
    expect(min).toBeLessThan(120);
  });
  it("jamais moins d'une minute", () => {
    expect(estimateMinutes(dakar, dakar)).toBe(1);
  });
  it("ancienneté lisible", () => {
    expect(agoLabel(5_000)).toBe("à l'instant");
    expect(agoLabel(40_000)).toBe("il y a 40 s");
    expect(agoLabel(5 * 60_000)).toBe("il y a 5 min");
  });
});
