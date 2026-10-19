import {
  cleanPermissions,
  PERMISSION_KEYS,
  SUPER_ADMIN_LABEL,
  SYSTEM_ROLES,
  type PermissionKey,
  type SystemRoleKey,
} from "./permissions";

/** Droits d'un compte d'administration à partir de son profil : le super
 * administrateur a tout, les autres ont les permissions de leur rôle (ou, sans
 * rôle enregistré, celles du rôle fourni du même nom). */
export function accessOf(
  staffRole: string | null,
  roleName: string | null,
  rolePermissions: readonly string[] | null,
): { staffRoleName: string | null; permissions: PermissionKey[] } {
  if (!staffRole) return { staffRoleName: null, permissions: [] };
  if (staffRole === "super_admin") {
    return { staffRoleName: SUPER_ADMIN_LABEL, permissions: [...PERMISSION_KEYS] };
  }
  if (roleName)
    return { staffRoleName: roleName, permissions: cleanPermissions(rolePermissions ?? []) };
  const fallback = SYSTEM_ROLES[staffRole as SystemRoleKey];
  return fallback
    ? { staffRoleName: fallback.name, permissions: [...fallback.permissions] }
    : { staffRoleName: null, permissions: [] };
}
