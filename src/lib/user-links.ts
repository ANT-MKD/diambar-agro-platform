import { farmers, restaurants, drivers } from "@/data/mocks";
import type { PlatformUser } from "@/data/admin-mocks";

/**
 * L'annuaire admin (platformUsers) et les données opérationnelles (farmers,
 * restaurants, drivers — utilisées par les commandes, missions, produits…)
 * sont deux jeux de données séparés, reliés seulement par le nom (pas
 * d'identifiant partagé). Cet alias couvre le seul cas où le nom diffère
 * entre les deux jeux de démo.
 */
const NAME_ALIASES: Record<string, string> = {
  "Hôtel Téranga": "Restaurant Téranga",
};

function resolvedName(name: string) {
  return NAME_ALIASES[name] ?? name;
}

export function findFarmerRecord(user: Pick<PlatformUser, "name" | "role">) {
  if (user.role !== "farmer") return undefined;
  return farmers.find((f) => f.name === resolvedName(user.name));
}

export function findRestaurantRecord(user: Pick<PlatformUser, "name" | "role">) {
  if (user.role !== "restaurant") return undefined;
  return restaurants.find((r) => r.name === resolvedName(user.name));
}

export function findDriverRecord(user: Pick<PlatformUser, "name" | "role">) {
  if (user.role !== "driver") return undefined;
  return drivers.find((d) => d.name === resolvedName(user.name));
}
