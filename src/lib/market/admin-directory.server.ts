import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  adminProfiles,
  adminRoles,
  auditLogs,
  cities,
  missions,
  orders,
  restaurants,
  users,
  teamMembers,
} from "@/db/schema";
import { loadPeople } from "./people.server";
import { accessOf } from "@/lib/auth/access";
import { auditModulesAllowed, type AdminRoleView } from "@/lib/auth/permissions";
import type { AccountRecord } from "@/lib/auth/store.server";
import { readAdminRoles } from "./admin-roles-db.server";
import type {
  AuditChange,
  AuditLevel,
  AuditLog,
  AuditModule,
  PlatformUser,
} from "@/data/admin-mocks";

// Annuaire de l'administration tiré de la base : les vrais comptes, le rôle
// de chaque membre de l'équipe et le journal d'audit (à la place des données
// de démonstration).

export type AdminDirectory = {
  users: PlatformUser[];
  /** Nom du rôle de chaque administrateur, par identifiant de compte. */
  staffRoles: Record<string, string>;
  /** Rôle attribué (identifiant, ou « super_admin »), par compte. */
  staffRoleIds: Record<string, string>;
  /** Équipe (regroupement libre) de chaque administrateur. */
  staffTeams: Record<string, string>;
  /** Rôles de l'administration et leurs permissions. */
  roles: AdminRoleView[];
  logs: AuditLog[];
};

const MODULES = new Set<AuditModule>([
  "users",
  "validations",
  "moderation",
  "orders",
  "deliveries",
  "incidents",
  "disputes",
  "support",
  "returns",
  "refunds",
  "finance",
  "messages",
  "security",
  "system",
]);

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

const show = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 80);
};

/** Champs modifiés, quand l'avant et l'après sont enregistrés. */
function changesOf(before: unknown, after: unknown): AuditChange[] | undefined {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(after)) return undefined;
  const prev = isObj(before) ? before : {};
  const out = Object.keys(after)
    .filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(after[k]))
    .slice(0, 8)
    .map((k) => ({ field: k, before: show(prev[k]), after: show(after[k]) }));
  return out.length ? out : undefined;
}

export async function readAdminDirectory(db: Db, me: AccountRecord): Promise<AdminDirectory> {
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      email: users.email,
      phone: users.phone,
      firstName: users.firstName,
      lastName: users.lastName,
      status: users.status,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      city: cities.name,
      restaurantName: restaurants.name,
    })
    .from(users)
    .leftJoin(cities, eq(cities.id, users.cityId))
    .leftJoin(restaurants, eq(restaurants.userId, users.id))
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt));

  // Activité réelle : commandes livrées (producteur, restaurant) et courses
  // livrées (livreur).
  const [farmerStats, restaurantStats, driverStats] = await Promise.all([
    db
      .select({
        id: orders.farmerId,
        n: sql<number>`count(*)::int`,
        gmv: sql<number>`coalesce(sum(${orders.subtotal}), 0)::int`,
      })
      .from(orders)
      .where(eq(orders.status, "delivered"))
      .groupBy(orders.farmerId),
    db
      .select({
        id: orders.restaurantId,
        n: sql<number>`count(*)::int`,
        gmv: sql<number>`coalesce(sum(${orders.subtotal}), 0)::int`,
      })
      .from(orders)
      .where(eq(orders.status, "delivered"))
      .groupBy(orders.restaurantId),
    db
      .select({
        id: missions.driverId,
        n: sql<number>`count(*)::int`,
        gmv: sql<number>`coalesce(sum(${missions.payout}), 0)::int`,
      })
      .from(missions)
      .where(eq(missions.status, "delivered"))
      .groupBy(missions.driverId),
  ]);
  const stats = new Map<string, { n: number; gmv: number }>();
  for (const s of [...farmerStats, ...restaurantStats, ...driverStats]) {
    if (s.id) stats.set(s.id, { n: Number(s.n), gmv: Number(s.gmv) });
  }

  const personName = (r: { firstName: string; lastName: string }) =>
    `${r.firstName} ${r.lastName}`.trim();
  // Comptes des membres d'équipe : rattachés à leur établissement.
  const memberRows = await db
    .select({ userId: teamMembers.userId, ownerId: teamMembers.ownerId })
    .from(teamMembers)
    .where(isNotNull(teamMembers.userId));
  const owners = await loadPeople(
    db,
    memberRows.map((m) => m.ownerId),
  );
  const teamOf = new Map(
    memberRows.map((m) => [m.userId!, owners.get(m.ownerId)?.name ?? "un établissement"]),
  );
  const userList: PlatformUser[] = rows.map((r) => ({
    id: r.id,
    name: teamOf.has(r.id)
      ? `${personName(r)} · équipe de ${teamOf.get(r.id)}`
      : r.role === "restaurant" && r.restaurantName
        ? r.restaurantName
        : personName(r),
    role: r.role,
    email: r.email,
    phone: r.phone ?? "",
    city: r.city ?? "",
    avatar: "",
    status: r.status,
    verified: r.status === "active",
    joinedAt: r.createdAt.toISOString(),
    lastActiveAt: (r.lastLoginAt ?? r.createdAt).toISOString(),
    orders: stats.get(r.id)?.n ?? 0,
    gmv: stats.get(r.id)?.gmv ?? 0,
    rating: 0,
  }));

  const staff = await db
    .select({
      userId: adminProfiles.userId,
      staffRole: adminProfiles.adminRole,
      team: adminProfiles.team,
      roleId: adminRoles.id,
      roleName: adminRoles.name,
      perms: adminRoles.permissions,
    })
    .from(adminProfiles)
    .leftJoin(
      adminRoles,
      or(
        eq(adminRoles.id, adminProfiles.roleId),
        and(
          isNull(adminProfiles.roleId),
          eq(adminRoles.systemKey, sql`${adminProfiles.adminRole}::text`),
        ),
      ),
    );
  const staffRoles: Record<string, string> = {};
  const staffRoleIds: Record<string, string> = {};
  const staffTeams: Record<string, string> = {};
  for (const s of staff) {
    staffRoles[s.userId] = accessOf(s.staffRole, s.roleName, s.perms).staffRoleName ?? "—";
    staffRoleIds[s.userId] = s.staffRole === "super_admin" ? "super_admin" : (s.roleId ?? "");
    if (s.team) staffTeams[s.userId] = s.team;
  }

  // Journal : seulement les modules que le rôle de la personne permet de voir.
  const modules = auditModulesAllowed(me.permissions);
  const dbModules = modules.flatMap((m) => (m === "users" ? ["users", "team"] : [m]));
  const logRows = modules.length
    ? await db
        .select()
        .from(auditLogs)
        .where(
          modules.includes("system")
            ? or(
                inArray(auditLogs.module, dbModules),
                sql`${auditLogs.module} not in (${sql.join(
                  [...MODULES, "team"].map((m) => sql`${m}`),
                  sql`, `,
                )})`,
              )
            : inArray(auditLogs.module, dbModules),
        )
        .orderBy(desc(auditLogs.at))
        .limit(300)
    : [];
  const nameById = new Map(rows.map((r) => [r.id, personName(r)]));
  const logs: AuditLog[] = logRows.map((l) => {
    // Actions des équipes des établissements : rangées avec les utilisateurs.
    const module =
      l.module === "team"
        ? "users"
        : MODULES.has(l.module as AuditModule)
          ? (l.module as AuditModule)
          : "system";
    const level: AuditLevel =
      l.status === "failed" || l.status === "blocked"
        ? "important"
        : module === "security" || module === "finance"
          ? "attention"
          : "info";
    const target =
      (l.targetId && nameById.get(l.targetId)) ||
      [l.targetType, l.targetId].filter(Boolean).join(" ") ||
      "—";
    return {
      id: l.id,
      at: iso(l.at)!,
      actor: (l.actorId && nameById.get(l.actorId)) || "Système",
      action: l.action,
      target,
      level,
      module,
      status: l.status,
      changes: changesOf(l.before, l.after),
    };
  });

  return {
    // Comptes : tous avec « Voir les utilisateurs », sinon seulement l'équipe
    // d'administration pour qui la gère.
    users: me.permissions.includes("users.view")
      ? userList
      : me.permissions.includes("security.manage_admins")
        ? userList.filter((u) => u.role === "admin")
        : [],
    staffRoles,
    staffRoleIds,
    staffTeams,
    roles: await readAdminRoles(db),
    logs,
  };
}
