// Rôles des équipes d'établissement et ce que chacun peut faire. Le
// titulaire du compte peut tout ; un membre agit dans la limite de son rôle,
// vérifiée côté serveur à chaque action.

export type TeamCap =
  | "read"
  | "order"
  | "reception"
  | "pay"
  | "aftersales"
  | "messages"
  | "suppliers"
  | "budget"
  | "catalog"
  | "stock"
  /** Réservés au titulaire : réglages du compte, retraits, équipe. */
  | "settings"
  | "payout"
  | "team";

export type RestaurantTeamRole = "buyer" | "chef" | "accountant" | "viewer";
export type FarmerTeamRole = "manager" | "stock" | "viewer";
export type TeamRole = RestaurantTeamRole | FarmerTeamRole;

export const TEAM_ROLES: {
  restaurant: Record<RestaurantTeamRole, { label: string; caps: TeamCap[] }>;
  farmer: Record<FarmerTeamRole, { label: string; caps: TeamCap[] }>;
} = {
  restaurant: {
    buyer: {
      label: "Acheteur",
      caps: ["read", "order", "reception", "pay", "aftersales", "messages", "suppliers"],
    },
    chef: {
      label: "Chef de cuisine",
      caps: ["read", "order", "reception", "aftersales", "messages", "suppliers"],
    },
    accountant: { label: "Comptable", caps: ["read", "pay", "budget", "messages"] },
    viewer: { label: "Lecture seule", caps: ["read"] },
  },
  farmer: {
    manager: {
      label: "Gérant",
      caps: ["read", "catalog", "stock", "order", "aftersales", "messages"],
    },
    stock: { label: "Gestion du stock", caps: ["read", "stock"] },
    viewer: { label: "Lecture seule", caps: ["read"] },
  },
};

export type TeamOwnerRole = keyof typeof TEAM_ROLES;

export function isTeamRole(ownerRole: TeamOwnerRole, role: string): role is TeamRole {
  return role in TEAM_ROLES[ownerRole];
}

export function teamRoleLabel(ownerRole: TeamOwnerRole, role: string): string {
  return (TEAM_ROLES[ownerRole] as Record<string, { label: string }>)[role]?.label ?? role;
}

export function teamRoleAllows(ownerRole: TeamOwnerRole, role: string, cap: TeamCap): boolean {
  const def = (TEAM_ROLES[ownerRole] as Record<string, { caps: TeamCap[] }>)[role];
  return !!def && def.caps.includes(cap);
}

/** Membre de l'équipe vu par le titulaire. */
export type TeamMemberView = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "invited" | "active" | "revoked";
  expiresAt?: string;
  lastLoginAt?: string;
};

/** Personne connectée quand ce n'est pas le titulaire. */
export type TeamSession = {
  memberName: string;
  role: string;
  roleLabel: string;
  ownerName: string;
  caps: TeamCap[];
};

/** Actions récentes des membres (traçabilité). */
export type TeamActivity = { at: string; memberName: string; action: string };
