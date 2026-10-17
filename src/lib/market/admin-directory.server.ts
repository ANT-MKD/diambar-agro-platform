import { desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  adminProfiles,
  auditLogs,
  cities,
  missions,
  orders,
  restaurants,
  users,
} from "@/db/schema";
import type {
  AdminRoleName,
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
  /** Rôle d'équipe de chaque administrateur, par identifiant de compte. */
  staffRoles: Record<string, AdminRoleName>;
  logs: AuditLog[];
};

const ROLE_NAME: Record<string, AdminRoleName> = {
  super_admin: "Super Administrateur",
  finance: "Finance",
  operations: "Opérations",
  support: "Support",
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

export async function readAdminDirectory(db: Db): Promise<AdminDirectory> {
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
  const userList: PlatformUser[] = rows.map((r) => ({
    id: r.id,
    name: r.role === "restaurant" && r.restaurantName ? r.restaurantName : personName(r),
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
    .select({ userId: adminProfiles.userId, role: adminProfiles.adminRole })
    .from(adminProfiles);
  const staffRoles: Record<string, AdminRoleName> = {};
  for (const s of staff) staffRoles[s.userId] = ROLE_NAME[s.role] ?? "Support";

  const logRows = await db.select().from(auditLogs).orderBy(desc(auditLogs.at)).limit(300);
  const nameById = new Map(rows.map((r) => [r.id, personName(r)]));
  const logs: AuditLog[] = logRows.map((l) => {
    const module = MODULES.has(l.module as AuditModule) ? (l.module as AuditModule) : "system";
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

  return { users: userList, staffRoles, logs };
}
