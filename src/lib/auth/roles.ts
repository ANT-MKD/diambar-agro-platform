import type { Role } from "@/data/mocks";

export const ROLE_DASHBOARD_PATH: Record<Role, string> = {
  farmer: "/farmer/dashboard",
  restaurant: "/restaurant/dashboard",
  driver: "/driver/dashboard",
  admin: "/admin/dashboard",
};

export const ROLE_LABEL: Record<Role, string> = {
  farmer: "agriculteur",
  restaurant: "restaurant",
  driver: "livreur",
  admin: "administrateur",
};

export function dashboardPathForRole(role: Role): string {
  return ROLE_DASHBOARD_PATH[role];
}
