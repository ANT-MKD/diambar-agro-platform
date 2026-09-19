import type { DriverVehicle, VehicleIssue } from "@/data/mocks";

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export type DocStatus = "valid" | "expiring" | "expired";
export function docStatus(days: number): DocStatus {
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

export type VehicleGlobalStatus = "ok" | "warning" | "blocked";

/** Statut de conformité réel du véhicule, calculé depuis les échéances de
 * documents et l'état mécanique déclaratif — réutilisé par la page Véhicule
 * et le bandeau d'état des Paramètres pour ne jamais afficher deux verdicts
 * différents sur la même donnée. */
export function vehicleCompliance(vehicle: DriverVehicle, issues: VehicleIssue[]) {
  const insStatus = docStatus(daysUntil(vehicle.insuranceExpiry));
  const inspStatus = docStatus(daysUntil(vehicle.inspectionExpiry));
  const conditionEntries = Object.values(vehicle.condition);
  const goodCount = conditionEntries.filter((s) => s === "good").length;
  const hasCriticalIssue = issues.some((i) => i.status !== "resolved" && i.severity === "high");

  const status: VehicleGlobalStatus =
    insStatus === "expired" || inspStatus === "expired"
      ? "blocked"
      : insStatus === "expiring" ||
          inspStatus === "expiring" ||
          hasCriticalIssue ||
          goodCount < conditionEntries.length
        ? "warning"
        : "ok";

  return { status, insStatus, inspStatus, goodCount, total: conditionEntries.length };
}

export const VEHICLE_STATUS_LABEL: Record<VehicleGlobalStatus, string> = {
  ok: "Véhicule opérationnel",
  warning: "Action requise",
  blocked: "Véhicule non conforme",
};
