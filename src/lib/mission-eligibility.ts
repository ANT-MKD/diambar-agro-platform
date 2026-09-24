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
  | { ok: true }
  | {
      ok: false;
      reason: "vehicle_blocked" | "overweight" | "overloaded" | "offline";
      message: string;
    };

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
  opts: { currentLoadKg?: number; online?: boolean } = {},
): Eligibility {
  if (opts.online === false) {
    return {
      ok: false,
      reason: "offline",
      message: "Vous êtes hors ligne : passez en ligne pour accepter des missions",
    };
  }
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
  // La marchandise des missions déjà acceptées occupe aussi le véhicule.
  const load = opts.currentLoadKg ?? 0;
  if (load > 0 && load + mission.weightKg > fleet.capacityKg) {
    return {
      ok: false,
      reason: "overloaded",
      message: `Déjà ${load} kg en cours : ${mission.weightKg} kg de plus dépasseraient les ${fleet.capacityKg} kg de votre ${fleet.type.toLowerCase()}`,
    };
  }
  return { ok: true };
}

/** Charge (kg) des missions d'un livreur pas encore livrées. */
export function currentLoadKg(missions: Mission[], driverId: string, exceptId?: string) {
  return missions
    .filter(
      (m) =>
        m.driverId === driverId &&
        m.id !== exceptId &&
        (m.status === "accepted" || m.status === "pickup" || m.status === "loaded"),
    )
    .reduce((s, m) => s + m.weightKg, 0);
}

// Attente payée (modèle Glovo) : au-delà de 10 minutes chez le producteur ou
// le restaurant, chaque minute est payée au livreur, dans la limite de 3 000
// FCFA par arrêt.
export const WAIT_FREE_MINUTES = 10;
export const WAIT_FCFA_PER_MINUTE = 50;
export const WAIT_CAP_FCFA = 3000;

export function waitCompensation(minutes: number) {
  return Math.min(
    WAIT_CAP_FCFA,
    Math.max(0, Math.floor(minutes) - WAIT_FREE_MINUTES) * WAIT_FCFA_PER_MINUTE,
  );
}

/** Une mission tombe-t-elle dans les horaires de travail déclarés ? */
export function withinWorkingHours(
  scheduledFor: string,
  hours: Record<string, { enabled: boolean; start: string; end: string }>,
) {
  const d = new Date(scheduledFor);
  const key = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
  const day = hours[key];
  if (!day) return true;
  if (!day.enabled) return false;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return hm >= day.start && hm <= day.end;
}
