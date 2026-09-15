import { describe, expect, it } from "vitest";
import { resolveTrackingConfig } from "./resolve-config";

describe("resolveTrackingConfig", () => {
  it("resolves a mission by its own reference, using its real GPS coordinates", () => {
    const config = resolveTrackingConfig("MIS-4200");
    expect(config).not.toBeNull();
    expect(config?.pickup).toMatchObject({ lat: 14.79, lng: -16.93 });
    expect(config?.dropoff).toMatchObject({ lat: 14.67, lng: -17.43 });
    // status "loaded" -> transit
    expect(config?.step).toBe("transit");
  });

  it("resolves the same mission via its linked order reference", () => {
    // trackingId echoes back whatever id was resolved *with*, so it differs
    // by design -- everything else should be identical.
    const { trackingId: _byMission, ...byMission } = resolveTrackingConfig("MIS-4200")!;
    const { trackingId: _byOrderRef, ...byOrderRef } = resolveTrackingConfig("CMD-2851")!;
    expect(byOrderRef).toEqual(byMission);
  });

  it("resolves a restaurant order via its own real delivery mission when one exists", () => {
    // ro_1 / CMD-3051 a une vraie mission liée (mi10, créée lors de la
    // commande) : elle doit primer sur le repli ville-par-ville.
    const config = resolveTrackingConfig("CMD-3051");
    expect(config).not.toBeNull();
    expect(config?.pickup.label).toBe("Route de Khombole km 3, Thiès");
    expect(config?.dropoff.label).toBe("Le Baobab, Dakar Plateau");
    // status "loaded" (mission) -> transit
    expect(config?.step).toBe("transit");
  });

  it("falls back to the farmer's and delivery address's city for a plain restaurant order", () => {
    // ro_2 / CMD-3050 : farmerId f2 (Coopérative Sow, Dakar-Pikine),
    // deliveryAddress "Le Baobab, Dakar Plateau", status preparing, sans
    // mission liée dans les données de démo.
    const config = resolveTrackingConfig("CMD-3050");
    expect(config).not.toBeNull();
    expect(config?.pickup.label).toBe("Coopérative Sow");
    expect(config?.dropoff.label).toBe("Le Baobab, Dakar Plateau");
    // status "preparing" -> pickup
    expect(config?.step).toBe("pickup");
  });

  it("returns null for an unknown tracking id", () => {
    expect(resolveTrackingConfig("DOES-NOT-EXIST")).toBeNull();
  });
});
