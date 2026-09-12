import { describe, expect, it } from "vitest";
import { cityCoords } from "./geo";

describe("cityCoords", () => {
  it("resolves a known city exactly", () => {
    expect(cityCoords("Dakar")).toEqual({ lat: 14.7167, lng: -17.4677 });
  });

  it("resolves an area name that contains a known city", () => {
    expect(cityCoords("Dakar Plateau")).toEqual(cityCoords("Dakar"));
    expect(cityCoords("Dakar-Pikine")).toEqual(cityCoords("Dakar"));
  });

  it("is case-insensitive when matching a contained city name", () => {
    expect(cityCoords("dakar plateau")).toEqual(cityCoords("Dakar"));
  });

  it("falls back to a deterministic position for an unknown place", () => {
    const a = cityCoords("Kédougou");
    const b = cityCoords("Kédougou");
    expect(a).toEqual(b);
  });

  it("gives different unknown places different fallback positions", () => {
    expect(cityCoords("Kédougou")).not.toEqual(cityCoords("Tambacounda"));
  });
});
