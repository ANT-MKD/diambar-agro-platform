import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { adminProfiles, auditLogs, notifications, users } from "@/db/schema";

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

export async function nextNumber(q: Q, sequence: string): Promise<number> {
  const rows = (await q.execute(
    sql`select nextval(${sequence}::regclass)::int as v`,
  )) as unknown as { v: number }[];
  return rows[0].v;
}

export type NotificationInput = {
  type: "order" | "payment" | "stock" | "system";
  title: string;
  body: string;
  link?: string;
};

export async function notifyUser(q: Q, userId: string, n: NotificationInput) {
  await q.insert(notifications).values({ userId, ...n });
}

/** Prévient les administrateurs actifs qui ont la main sur l'argent. */
export async function notifyFinanceStaff(q: Q, n: NotificationInput) {
  const staff = await q
    .select({ id: users.id })
    .from(adminProfiles)
    .innerJoin(users, eq(users.id, adminProfiles.userId))
    .where(
      and(eq(users.status, "active"), inArray(adminProfiles.adminRole, ["super_admin", "finance"])),
    );
  for (const s of staff) await notifyUser(q, s.id, n);
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
  },
) {
  await q.insert(auditLogs).values({
    actorId: entry.actorId,
    module: "finance",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    status: entry.status ?? "success",
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
