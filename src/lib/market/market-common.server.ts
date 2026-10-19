import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { adminProfiles, adminRoles, auditLogs, notifications, users } from "@/db/schema";
import { accessOf } from "@/lib/auth/access";
import type { PermissionKey } from "@/lib/auth/permissions";

// Outils partagés par les opérations de la place de marché (commandes,
// missions, paiements) : erreurs montrées telles quelles, notifications,
// compteurs de références, journal d'audit.

/** Règle non respectée : le message est montré tel quel à la personne et
 * la transaction est annulée. */
export class MarketError extends Error {}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Q = Db | Tx;

export function fail(message: string): never {
  throw new MarketError(message);
}

/** Ville, quartier ou lieu de collecte sans position : on ne livre pas sur
 * une distance devinée. */
export class UnlocatedPlaceError extends MarketError {
  constructor(
    message: string,
    readonly place: string,
  ) {
    super(message);
  }
}

export async function nextNumber(q: Q, sequence: string): Promise<number> {
  const rows = (await q.execute(
    sql`select nextval(${sequence}::regclass)::int as v`,
  )) as unknown as { v: number }[];
  return rows[0].v;
}

export type NotificationInput = {
  /** « offer » : course ouverte annoncée à tous les livreurs. */
  type: "order" | "payment" | "stock" | "system" | "offer" | "message";
  title: string;
  body: string;
  link?: string;
};

/** Notifications que la personne peut couper dans ses réglages (les
 * paiements, litiges et messages de l'équipe arrivent toujours). */
export const MUTABLE_NOTIFICATIONS = ["order", "stock", "offer"] as const;

export async function notifyUser(q: Q, userId: string, n: NotificationInput) {
  if ((MUTABLE_NOTIFICATIONS as readonly string[]).includes(n.type)) {
    const [u] = await q
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId));
    const muted = (u?.preferences as { mutedNotifications?: unknown } | null)?.mutedNotifications;
    if (Array.isArray(muted) && muted.includes(n.type)) return;
  }
  await q.insert(notifications).values({ userId, ...n });
}

/** Rôle d'un profil admin : celui choisi, ou à défaut le rôle fourni qui
 * porte le même nom système. */
const roleOfProfile = or(
  eq(adminRoles.id, adminProfiles.roleId),
  and(
    isNull(adminProfiles.roleId),
    eq(adminRoles.systemKey, sql`${adminProfiles.adminRole}::text`),
  ),
);

/** Administrateurs actifs qui ont cette permission (super admin compris). */
export async function staffWithPermission(q: Q, permission: PermissionKey): Promise<string[]> {
  const rows = await q
    .select({ id: users.id })
    .from(adminProfiles)
    .innerJoin(users, eq(users.id, adminProfiles.userId))
    .leftJoin(adminRoles, roleOfProfile)
    .where(
      and(
        eq(users.status, "active"),
        or(
          eq(adminProfiles.adminRole, "super_admin"),
          sql`${permission} = any(${adminRoles.permissions})`,
        ),
      ),
    );
  return rows.map((r) => r.id);
}

/** Permissions effectives d'un compte admin (vide pour les autres comptes). */
export async function permissionsOf(q: Q, userId: string): Promise<PermissionKey[]> {
  const [p] = await q
    .select({
      staffRole: adminProfiles.adminRole,
      roleName: adminRoles.name,
      perms: adminRoles.permissions,
    })
    .from(adminProfiles)
    .leftJoin(adminRoles, roleOfProfile)
    .where(eq(adminProfiles.userId, userId));
  return p ? accessOf(p.staffRole, p.roleName, p.perms).permissions : [];
}

export async function hasPermission(q: Q, userId: string, permission: PermissionKey) {
  return (await permissionsOf(q, userId)).includes(permission);
}

export async function requirePermission(
  q: Q,
  userId: string,
  permission: PermissionKey,
  message = "Votre rôle ne permet pas cette action.",
) {
  if (!(await hasPermission(q, userId, permission))) fail(message);
}

/** Prévient les administrateurs actifs qui ont la main sur l'argent. */
export async function notifyFinanceStaff(
  q: Q,
  n: NotificationInput,
  permission: PermissionKey = "finance.edit",
) {
  for (const id of await staffWithPermission(q, permission)) await notifyUser(q, id, n);
}

/** Prévient les administrateurs chargés de ce sujet (par défaut : les
 * opérations, qui gèrent les commandes). */
export async function notifyOpsStaff(
  q: Q,
  n: NotificationInput,
  permission: PermissionKey = "orders.manage",
) {
  for (const id of await staffWithPermission(q, permission)) await notifyUser(q, id, n);
}

/** Prévient les administrateurs des opérations, une seule fois par jour
 * pour le même message. */
export async function notifyOpsStaffOnce(
  q: Q,
  n: NotificationInput,
  permission: PermissionKey = "pricing.edit",
) {
  const staff = (await staffWithPermission(q, permission)).map((id) => ({ id }));
  const since = new Date(Date.now() - 24 * 3600_000);
  for (const s of staff) {
    const [already] = await q
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, s.id),
          eq(notifications.title, n.title),
          eq(notifications.body, n.body),
          gt(notifications.createdAt, since),
        ),
      )
      .limit(1);
    if (!already) await notifyUser(q, s.id, n);
  }
}

export async function audit(
  q: Q,
  entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
    status?: "success" | "failed" | "blocked" | "cancelled";
    module?: string;
  },
) {
  await q.insert(auditLogs).values({
    actorId: entry.actorId,
    module: entry.module ?? "finance",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    status: entry.status ?? "success",
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
