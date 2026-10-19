import { and, asc, count, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { adminProfiles, adminRoles, users } from "@/db/schema";
import {
  cleanPermissions,
  SUPER_ADMIN_LABEL,
  SYSTEM_ROLES,
  type AdminRoleView,
  type PermissionKey,
} from "@/lib/auth/permissions";
import type { AccountRecord } from "@/lib/auth/store.server";
import { audit, fail, notifyUser, type Q } from "./market-common.server";

// Rôles de l'administration en base. Créer ou modifier un rôle demande
// « Créer et modifier les rôles » ; donner un rôle à quelqu'un, « Inviter les
// administrateurs et leur donner un rôle ». Hors super admin, personne ne
// donne une permission qu'il n'a pas lui-même, ni ne touche à son propre rôle :
// impossible de s'accorder plus de droits par ce biais.

export type RoleInput = { name: string; description: string; permissions: string[] };

const SUPER = "super_admin";

function requireActor(actor: AccountRecord, permission: PermissionKey) {
  if (actor.role !== "admin" || !actor.permissions.includes(permission)) {
    fail("Votre rôle ne permet pas cette action.");
  }
}

/** Hors super admin : seulement des permissions que l'on a soi-même. */
function checkGrantable(actor: AccountRecord, permissions: readonly PermissionKey[]) {
  if (actor.staffRole === SUPER) return;
  const missing = permissions.filter((p) => !actor.permissions.includes(p));
  if (missing.length) {
    fail("Vous ne pouvez pas accorder une permission que votre propre rôle n'a pas.");
  }
}

function cleanInput(input: RoleInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) fail("Le nom du rôle fait de 2 à 60 caractères.");
  if (name.toLowerCase() === SUPER_ADMIN_LABEL.toLowerCase()) {
    fail("Ce nom est réservé au super administrateur.");
  }
  return {
    name,
    description: input.description.trim().slice(0, 300),
    permissions: cleanPermissions(input.permissions),
  };
}

async function nameTaken(q: Q, name: string, exceptId?: string) {
  const [row] = await q
    .select({ id: adminRoles.id })
    .from(adminRoles)
    .where(
      and(
        sql`lower(${adminRoles.name}) = ${name.toLowerCase()}`,
        exceptId ? ne(adminRoles.id, exceptId) : undefined,
      ),
    );
  return !!row;
}

async function roleById(q: Q, id: string) {
  const [role] = await q.select().from(adminRoles).where(eq(adminRoles.id, id));
  if (!role) fail("Rôle introuvable.");
  return role;
}

/** Rôle effectif d'un profil : celui choisi, sinon le rôle fourni du même nom. */
async function currentRoleId(q: Q, userId: string): Promise<string | null> {
  const [p] = await q
    .select({ roleId: adminProfiles.roleId, staffRole: adminProfiles.adminRole })
    .from(adminProfiles)
    .where(eq(adminProfiles.userId, userId));
  if (!p) return null;
  if (p.roleId) return p.roleId;
  const [r] = await q
    .select({ id: adminRoles.id })
    .from(adminRoles)
    .where(eq(adminRoles.systemKey, p.staffRole));
  return r?.id ?? null;
}

export async function readAdminRoles(q: Q): Promise<AdminRoleView[]> {
  const [roles, members] = await Promise.all([
    q.select().from(adminRoles).orderBy(asc(adminRoles.createdAt), asc(adminRoles.name)),
    q
      .select({ roleId: adminProfiles.roleId, staffRole: adminProfiles.adminRole, n: count() })
      .from(adminProfiles)
      .innerJoin(users, eq(users.id, adminProfiles.userId))
      .where(ne(adminProfiles.adminRole, SUPER))
      .groupBy(adminProfiles.roleId, adminProfiles.adminRole),
  ]);
  const membersOf = (r: (typeof roles)[number]) =>
    members
      .filter((m) => m.roleId === r.id || (!m.roleId && m.staffRole === r.systemKey))
      .reduce((sum, m) => sum + m.n, 0);
  // Rôles fournis d'abord, dans l'ordre de l'installation, puis ceux créés.
  const systemOrder = Object.keys(SYSTEM_ROLES);
  const rank = (r: (typeof roles)[number]) =>
    r.systemKey ? systemOrder.indexOf(r.systemKey) : systemOrder.length;
  roles.sort((a, b) => rank(a) - rank(b));
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: cleanPermissions(r.permissions),
    system: !!r.systemKey,
    members: membersOf(r),
  }));
}

export async function createAdminRole(db: Db, actor: AccountRecord, input: RoleInput) {
  requireActor(actor, "security.manage_roles");
  const role = cleanInput(input);
  if (role.permissions.length === 0) fail("Choisissez au moins une permission.");
  checkGrantable(actor, role.permissions);
  return db.transaction(async (tx) => {
    if (await nameTaken(tx, role.name)) fail("Un rôle porte déjà ce nom.");
    const [created] = await tx
      .insert(adminRoles)
      .values({ ...role, createdBy: actor.id })
      .returning({ id: adminRoles.id });
    await audit(tx, {
      module: "security",
      actorId: actor.id,
      action: `Rôle créé : ${role.name}`,
      targetType: "admin_role",
      targetId: created.id,
      after: role,
    });
    return created;
  });
}

export async function updateAdminRole(db: Db, actor: AccountRecord, id: string, input: RoleInput) {
  requireActor(actor, "security.manage_roles");
  const next = cleanInput(input);
  return db.transaction(async (tx) => {
    const role = await roleById(tx, id);
    if (actor.staffRole !== SUPER && (await currentRoleId(tx, actor.id)) === role.id) {
      fail("Votre propre rôle se modifie par un autre administrateur.");
    }
    const before = cleanPermissions(role.permissions);
    // Hors super admin : n'ajouter que des permissions que l'on a ; celles
    // déjà présentes peuvent rester.
    checkGrantable(
      actor,
      next.permissions.filter((p) => !before.includes(p)),
    );
    if (role.systemKey && next.name !== role.name) {
      fail("Le nom d'un rôle fourni ne change pas.");
    }
    if (next.permissions.length === 0) fail("Choisissez au moins une permission.");
    if (await nameTaken(tx, next.name, role.id)) fail("Un rôle porte déjà ce nom.");
    await tx
      .update(adminRoles)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(adminRoles.id, role.id));
    await audit(tx, {
      module: "security",
      actorId: actor.id,
      action: `Rôle modifié : ${next.name}`,
      targetType: "admin_role",
      targetId: role.id,
      before: { name: role.name, description: role.description, permissions: before },
      after: next,
    });
  });
}

export async function deleteAdminRole(db: Db, actor: AccountRecord, id: string) {
  requireActor(actor, "security.manage_roles");
  return db.transaction(async (tx) => {
    const role = await roleById(tx, id);
    if (role.systemKey) fail("Un rôle fourni ne se supprime pas (vous pouvez le modifier).");
    const [{ n }] = await tx
      .select({ n: count() })
      .from(adminProfiles)
      .where(eq(adminProfiles.roleId, role.id));
    if (n > 0) {
      fail(`${n} administrateur(s) ont ce rôle : donnez-leur d'abord un autre rôle.`);
    }
    checkGrantable(actor, cleanPermissions(role.permissions));
    await tx.delete(adminRoles).where(eq(adminRoles.id, role.id));
    await audit(tx, {
      module: "security",
      actorId: actor.id,
      action: `Rôle supprimé : ${role.name}`,
      targetType: "admin_role",
      targetId: role.id,
      before: { name: role.name, permissions: role.permissions },
    });
  });
}

/** Donne un rôle (ou le statut de super admin) à un administrateur. */
export async function assignAdminRole(
  db: Db,
  actor: AccountRecord,
  userId: string,
  target: { roleId: string } | { superAdmin: true },
) {
  requireActor(actor, "security.manage_admins");
  if (userId === actor.id) fail("Votre propre rôle se change par un autre administrateur.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: users.status, role: users.role, staffRole: adminProfiles.adminRole })
      .from(users)
      .innerJoin(adminProfiles, eq(adminProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .for("update", { of: adminProfiles });
    if (!row || row.role !== "admin") fail("Administrateur introuvable.");
    const wasSuper = row.staffRole === SUPER;
    const makeSuper = "superAdmin" in target;
    if ((wasSuper || makeSuper) && actor.staffRole !== SUPER) {
      fail("Seul un super admin donne ou retire le statut de super admin.");
    }
    if (wasSuper && !makeSuper) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(adminProfiles)
        .innerJoin(users, eq(users.id, adminProfiles.userId))
        .where(
          and(eq(adminProfiles.adminRole, SUPER), eq(users.status, "active"), ne(users.id, userId)),
        );
      if (n === 0) fail("Il doit rester au moins un super admin actif.");
    }
    let label = SUPER_ADMIN_LABEL;
    if (makeSuper) {
      await tx
        .update(adminProfiles)
        .set({ adminRole: SUPER, roleId: null })
        .where(eq(adminProfiles.userId, userId));
    } else {
      const role = await roleById(tx, target.roleId);
      checkGrantable(actor, cleanPermissions(role.permissions));
      label = role.name;
      await tx
        .update(adminProfiles)
        .set({
          // L'ancienne colonne ne sert plus qu'à distinguer le super admin.
          adminRole:
            role.systemKey === "operations" || role.systemKey === "finance"
              ? role.systemKey
              : "support",
          roleId: role.id,
        })
        .where(eq(adminProfiles.userId, userId));
    }
    await audit(tx, {
      module: "security",
      actorId: actor.id,
      action: `Rôle admin modifié : ${label}`,
      targetType: "user",
      targetId: userId,
      after: { role: label },
    });
    await notifyUser(tx, userId, {
      type: "system",
      title: "Votre rôle a changé",
      body: `Vous avez maintenant le rôle « ${label} ».`,
      link: "/admin/dashboard",
    });
  });
}

/** Équipe d'un administrateur : regroupement libre, sans effet sur les droits. */
export async function setAdminTeam(db: Db, actor: AccountRecord, userId: string, team: string) {
  requireActor(actor, "security.manage_admins");
  const name = team.trim().replace(/\s+/g, " ").slice(0, 60);
  const [p] = await db
    .update(adminProfiles)
    .set({ team: name || null })
    .where(eq(adminProfiles.userId, userId))
    .returning({ userId: adminProfiles.userId });
  if (!p) fail("Administrateur introuvable.");
  await audit(db, {
    module: "security",
    actorId: actor.id,
    action: name ? `Équipe admin : ${name}` : "Équipe admin retirée",
    targetType: "user",
    targetId: userId,
  });
}
