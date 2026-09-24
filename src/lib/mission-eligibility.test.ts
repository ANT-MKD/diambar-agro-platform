import { describe, expect, it } from "vitest";
import { driverSettings, driverVehicle, type Mission } from "@/data/mocks";
import { autoAcceptableMissions } from "@/data/store";
import { fleetForDriver, missionEligibility, type DriverFleet } from "./mission-eligibility";

const moto: DriverFleet = { type: "Moto", capacityKg: 40, status: "ok" };

describe("missionEligibility", () => {
  it("accepts a load that fits the vehicle", () => {
    expect(missionEligibility({ weightKg: 40 }, moto).ok).toBe(true);
  });

  it("rejects a load heavier than the vehicle capacity", () => {
    const result = missionEligibility({ weightKg: 300 }, moto);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("overweight");
  });

  it("rejects any mission when the vehicle is non-compliant, even a light one", () => {
    const result = missionEligibility({ weightKg: 1 }, { ...moto, status: "blocked" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("vehicle_blocked");
  });
});

describe("fleetForDriver", () => {
  it("uses the live vehicle file for the connected driver", () => {
    const fleet = fleetForDriver("d1", driverVehicle, []);
    expect(fleet?.capacityKg).toBe(driverVehicle.capacityKg);
  });

  it("blocks a driver whose insurance has expired", () => {
    const expired = { ...driverVehicle, insuranceExpiry: "2000-01-01" };
    expect(fleetForDriver("d1", expired, [])?.status).toBe("blocked");
  });

  it("falls back to the pool summary for other drivers", () => {
    expect(fleetForDriver("d2", driverVehicle, [])?.capacityKg).toBe(1000);
    expect(fleetForDriver("unknown", driverVehicle, [])).toBeNull();
  });
});

describe("autoAcceptableMissions", () => {
  const mission = (weightKg: number): Mission =>
    ({
      id: `m${weightKg}`,
      status: "available",
      payout: 10000,
      weightKg,
      urgency: "standard",
      pickup: { city: "Dakar" },
      dropoff: { city: "Dakar" },
    }) as unknown as Mission;
  const settings = { ...driverSettings, autoAccept: true };

  it("never exceeds the real vehicle capacity, whatever the driver's own setting", () => {
    const picked = autoAcceptableMissions([mission(30), mission(300)], settings, moto);
    expect(picked.map((m) => m.weightKg)).toEqual([30]);
  });

  it("accepts nothing while the vehicle is non-compliant", () => {
    const picked = autoAcceptableMissions([mission(30)], settings, { ...moto, status: "blocked" });
    expect(picked).toEqual([]);
  });
});
