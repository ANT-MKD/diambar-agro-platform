import { and, eq, ne } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { adminProfiles, users } from "@/db/schema";
import type { AccountRecord } from "@/lib/auth/store.server";
import { audit, fail } from "./market-common.server";

// Suspendre, réactiver ou refuser un compte depuis l'administration. Un
// compte suspendu perd l'accès à sa prochaine requête (la session vérifie le
// statut) ; ses produits sortent du catalogue. Les comptes en attente se
// décident dans Validations. Réservé au super admin.

export type AccountStatusChange = "active" | "suspended" | "rejected";

export async function setAccountStatus(
  db: Db,
  actor: AccountRecord,
  userId: string,
  status: AccountStatusChange,
  reason = "",
) {
  const why = reason.trim().slice(0, 300);
  if (actor.role !== "admin" || !actor.permissions.includes("users.suspend")) {
    fail("Votre rôle ne permet pas de changer le statut d'un compte.");
  }
  if (userId === actor.id) fail("Vous ne pouvez pas changer le statut de votre propre compte.");
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!u) fail("Compte introuvable.");
    if (u.status === status) return;
    if (u.status === "pending") {
      fail("Ce compte attend sa validation : décidez depuis Validations.");
    }
    if (u.role === "admin") {
      const [prof] = await tx
        .select({ role: adminProfiles.adminRole })
        .from(adminProfiles)
        .where(eq(adminProfiles.userId, userId));
      // Un compte de l'administration se gère avec les administrateurs ; un
      // super admin, seulement par un autre super admin.
      if (!actor.permissions.includes("security.manage_admins")) {
        fail("Votre rôle ne permet pas de gérer les comptes de l'administration.");
      }
      if (prof?.role === "super_admin" && actor.staffRole !== "super_admin") {
        fail("Seul un super admin change le statut d'un autre super admin.");
      }
      if (prof?.role === "super_admin" && status !== "active") {
        const others = await tx
          .select({ id: users.id })
          .from(users)
          .innerJoin(adminProfiles, eq(adminProfiles.userId, users.id))
          .where(
            and(
              eq(adminProfiles.adminRole, "super_admin"),
              eq(users.status, "active"),
              ne(users.id, userId),
            ),
          );
        if (!others.length) fail("Il doit rester au moins un super admin actif.");
      }
    }
    await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
    await audit(tx, {
      module: "security",
      actorId: actor.id,
      action:
        status === "active"
          ? "Compte réactivé"
          : status === "suspended"
            ? "Compte suspendu"
            : "Compte refusé",
      targetType: "user",
      targetId: userId,
      before: { status: u.status },
      after: why ? { status, reason: why } : { status },
    });
  });
}
