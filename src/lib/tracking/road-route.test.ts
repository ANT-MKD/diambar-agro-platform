import { describe, expect, it, vi } from "vitest";
import {
  distanceToRouteKm,
  fetchRoadRoute,
  needsReroute,
  remainingRoute,
  type RoadRoute,
} from "./road-route";

// Colobane → Plateau (Dakar), tracé simplifié.
const LINE = [
  { lat: 14.6965, lng: -17.444 },
  { lat: 14.685, lng: -17.441 },
  { lat: 14.676, lng: -17.439 },
  { lat: 14.6693, lng: -17.4373 },
];
const ROUTE: RoadRoute = { points: LINE, distanceKm: 3.2, durationMin: 12, to: LINE[3] };

describe("itinéraire routier", () => {
  it("lit la réponse de Mapbox Directions (lng,lat → lat,lng ; m → km ; s → min)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              geometry: { coordinates: LINE.map((p) => [p.lng, p.lat]) },
              distance: 3200,
              duration: 720,
            },
          ],
        }),
      ),
    );
    const r = await fetchRoadRoute(LINE[0], LINE[3], "pk.test", fetchMock);
    expect(r).toMatchObject({ distanceKm: 3.2, durationMin: 12, to: LINE[3] });
    expect(r?.points[0]).toEqual(LINE[0]);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(
      "/directions/v5/mapbox/driving-traffic/-17.444000,14.696500;-17.437300,14.669300",
    );
    expect(url).toContain("access_token=pk.test");
  });

  it("refus ou réponse vide : pas d'itinéraire", async () => {
    const denied = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await fetchRoadRoute(LINE[0], LINE[3], "pk.x", denied)).toBeNull();
    const empty = vi.fn().mockResolvedValue(new Response(JSON.stringify({ routes: [] })));
    expect(await fetchRoadRoute(LINE[0], LINE[3], "pk.x", empty)).toBeNull();
  });

  it("recalcul seulement si l'arrêt change ou si le livreur quitte la route", () => {
    expect(needsReroute(null, LINE[0], LINE[3])).toBe(true);
    // Sur la route (entre deux points) : on garde le calcul.
    expect(needsReroute(ROUTE, { lat: 14.68, lng: -17.44 }, LINE[3])).toBe(false);
    // 400 m à l'ouest : il a pris une autre route.
    expect(needsReroute(ROUTE, { lat: 14.68, lng: -17.4437 - 0.0037 }, LINE[3])).toBe(true);
    // Nouvel arrêt (livraison après la collecte).
    expect(needsReroute(ROUTE, LINE[0], { lat: 14.7, lng: -17.46 })).toBe(true);
  });

  it("distance à la route : nulle sur un segment, croissante à l'écart", () => {
    expect(distanceToRouteKm({ lat: 14.68, lng: -17.44 }, LINE)).toBeLessThan(0.05);
    const off = distanceToRouteKm({ lat: 14.68, lng: -17.45 }, LINE);
    expect(off).toBeGreaterThan(0.9);
    expect(off).toBeLessThan(1.2);
  });

  it("reste du trajet : la partie faite est retirée, la durée réduite d'autant", () => {
    const here = { lat: 14.6761, lng: -17.439 };
    const rest = remainingRoute(ROUTE, here);
    expect(rest.points[0]).toEqual(here);
    expect(rest.points.at(-1)).toEqual(LINE[3]);
    expect(rest.durationMin).toBeLessThan(5);
    expect(rest.durationMin).toBeGreaterThan(1);
  });
});
