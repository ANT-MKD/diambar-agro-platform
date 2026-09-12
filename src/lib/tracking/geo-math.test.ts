import { describe, expect, it } from "vitest";
import { bearingDeg, etaMinutesFromRoute, haversineKm, pointAlongRoute } from "./geo-math";

const THIES = { lat: 14.7886, lng: -16.9246 };
const DAKAR = { lat: 14.7167, lng: -17.4677 };

describe("geo-math", () => {
  it("computes a plausible driving distance between Thiès and Dakar", () => {
    const km = haversineKm(THIES, DAKAR);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(70);
  });

  it("returns 0 for the same point", () => {
    expect(haversineKm(THIES, THIES)).toBeCloseTo(0, 5);
  });

  it("points roughly east/west between the two cities", () => {
    const deg = bearingDeg(THIES, DAKAR);
    expect(deg).toBeGreaterThan(180);
    expect(deg).toBeLessThan(300);
  });

  describe("pointAlongRoute", () => {
    const route = [THIES, { lat: 14.75, lng: -17.2 }, DAKAR];

    it("returns the start point at progress 0", () => {
      expect(pointAlongRoute(route, 0)).toEqual(THIES);
    });

    it("returns the end point at progress 1", () => {
      expect(pointAlongRoute(route, 1)).toEqual(DAKAR);
    });

    it("returns a point strictly between the endpoints at progress 0.5", () => {
      const mid = pointAlongRoute(route, 0.5);
      expect(mid.lng).toBeGreaterThan(DAKAR.lng);
      expect(mid.lng).toBeLessThan(THIES.lng);
    });

    it("handles an empty route without throwing", () => {
      expect(pointAlongRoute([], 0.5)).toEqual({ lat: 0, lng: 0 });
    });

    it("handles a single-point route", () => {
      expect(pointAlongRoute([THIES], 0.5)).toEqual(THIES);
    });
  });

  describe("etaMinutesFromRoute", () => {
    it("decreases as progress increases", () => {
      const route = [THIES, DAKAR];
      const etaStart = etaMinutesFromRoute(route, 0);
      const etaMid = etaMinutesFromRoute(route, 0.5);
      const etaEnd = etaMinutesFromRoute(route, 0.99);
      expect(etaStart).toBeGreaterThan(etaMid);
      expect(etaMid).toBeGreaterThan(etaEnd);
    });

    it("never returns less than 1 minute", () => {
      expect(etaMinutesFromRoute([THIES, DAKAR], 1)).toBeGreaterThanOrEqual(1);
    });
  });
});
