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

  it("falls back to the farmer's and delivery address's city for a plain restaurant order", () => {
    // ro_1: farmerId f1 (Thiès), deliveryAddress "Le Baobab, Dakar Plateau", status delivering
    const config = resolveTrackingConfig("CMD-3051");
    expect(config).not.toBeNull();
    expect(config?.pickup.label).toBe("Ferme Diallo");
    expect(config?.dropoff.label).toBe("Le Baobab, Dakar Plateau");
    // status "delivering" -> transit
    expect(config?.step).toBe("transit");
  });

  it("returns null for an unknown tracking id", () => {
    expect(resolveTrackingConfig("DOES-NOT-EXIST")).toBeNull();
  });
});
