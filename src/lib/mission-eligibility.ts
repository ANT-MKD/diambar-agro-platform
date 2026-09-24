import { driverFleetSeed, type DriverVehicle, type Mission, type VehicleIssue } from "@/data/mocks";
import {
  daysUntil,
  docStatus,
  vehicleCompliance,
  type VehicleGlobalStatus,
} from "@/lib/vehicle-status";

export type DriverFleet = {
  type: DriverVehicle["type"];
  capacityKg: number;
  status: VehicleGlobalStatus;
};

export type Eligibility =
  { ok: true } | { ok: false; reason: "vehicle_blocked" | "overweight"; message: string };

/**
 * Véhicule et conformité réels d'un livreur. Seul le livreur connecté de la
 * démo ("d1") a un dossier véhicule complet et modifiable ; les autres
 * livreurs du vivier n'ont qu'un résumé (type, capacité, échéances).
 */
export function fleetForDriver(
  driverId: string,
  liveVehicle: DriverVehicle,
  liveIssues: VehicleIssue[],
): DriverFleet | null {
  if (driverId === "d1") {
    return {
      type: liveVehicle.type,
      capacityKg: liveVehicle.capacityKg,
      status: vehicleCompliance(liveVehicle, liveIssues).status,
    };
  }
  const seed = driverFleetSeed[driverId];
  if (!seed) return null;
  const expired =
    docStatus(daysUntil(seed.insuranceExpiry)) === "expired" ||
    docStatus(daysUntil(seed.inspectionExpiry)) === "expired";
  return {
    type: seed.type,
    capacityKg: seed.capacityKg,
    status: expired ? "blocked" : "ok",
  };
}

/** Un véhicule non conforme ne prend aucune course ; sinon la charge doit
 * tenir dans sa capacité déclarée. */
export function missionEligibility(
  mission: Pick<Mission, "weightKg">,
  fleet: DriverFleet,
): Eligibility {
  if (fleet.status === "blocked") {
    return {
      ok: false,
      reason: "vehicle_blocked",
      message: "Véhicule non conforme (assurance ou contrôle technique expiré)",
    };
  }
  if (mission.weightKg > fleet.capacityKg) {
    return {
      ok: false,
      reason: "overweight",
      message: `${mission.weightKg} kg à transporter, capacité ${fleet.type.toLowerCase()} : ${fleet.capacityKg} kg max`,
    };
  }
  return { ok: true };
}
