import { and, desc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { auditLogs, teamMembers, users } from "@/db/schema";
import { fail, notifyUser, type Q } from "./market-common.server";
import { loadPeople } from "./people.server";
import {
  isTeamRole,
  teamRoleLabel,
  type TeamActivity,
  type TeamMemberView,
  type TeamOwnerRole,
} from "./team";

// Équipes des établissements en base. Le titulaire invite par e-mail ; le
// membre crée son propre compte (même rôle de portail que le titulaire) et
// agit sur l'espace du titulaire dans la limite de son rôle d'équipe. Retirer
// un membre suspend son compte : il perd l'accès à sa prochaine requête.

export const INVITE_TTL_MS = 7 * 24 * 3_600_000;
const MAX_MEMBERS = 20;

export type TeamContext = { memberId: string; ownerId: string; role: string };

/** Le compte est-il un membre actif d'une équipe ? (null pour un titulaire) */
export async function teamContextFor(q: Q, accountId: string): Promise<TeamContext | null> {
  const [m] = await q
    .select({ id: teamMembers.id, ownerId: teamMembers.ownerId, role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, accountId), eq(teamMembers.status, "active")));
  return m ? { memberId: m.id, ownerId: m.ownerId, role: m.role } : null;
}

const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function inviteMember(
  db: Db,
  owner: { id: string; role: TeamOwnerRole },
  input: { email: string; role: string },
): Promise<{ memberId: string; email: string }> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Adresse e-mail invalide.");
  if (!isTeamRole(owner.role, input.role)) fail("Rôle inconnu.");
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) {
      fail("Cette adresse a déjà un compte Diambar : invitez une autre adresse.");
    }
    const current = await tx
      .select({ id: teamMembers.id, email: teamMembers.email, status: teamMembers.status })
      .from(teamMembers)
      .where(
        and(eq(teamMembers.ownerId, owner.id), inArray(teamMembers.status, ["invited", "active"])),
      );
    if (current.some((m) => m.email === email)) {
      fail("Cette personne est déjà invitée : renvoyez l'invitation depuis la liste.");
    }
    if (current.length >= MAX_MEMBERS) fail(`Au plus ${MAX_MEMBERS} membres par équipe.`);
    const [m] = await tx
      .insert(teamMembers)
      .values({
        ownerId: owner.id,
        email,
        role: input.role,
        invitedBy: owner.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      })
      .returning({ id: teamMembers.id });
    await tx.insert(auditLogs).values({
      actorId: owner.id,
      module: "team",
      action: `Invitation envoyée (${teamRoleLabel(owner.role, input.role)})`,
      targetType: "email",
      targetId: email,
    });
    return { memberId: m.id, email };
  });
}

async function mine(q: Q, ownerId: string, memberId: string) {
  const [m] = await q
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.ownerId, ownerId)));
  if (!m) fail("Membre introuvable.");
  return m;
}

/** Nouvelle invitation (nouvelle échéance) pour une personne pas encore inscrite. */
export async function renewInvite(db: Db, ownerId: string, memberId: string) {
  const m = await mine(db, ownerId, memberId);
  if (m.status !== "invited") fail("Cette personne a déjà rejoint l'équipe.");
  await db
    .update(teamMembers)
    .set({ expiresAt: new Date(Date.now() + INVITE_TTL_MS), updatedAt: new Date() })
    .where(eq(teamMembers.id, m.id));
  return { memberId: m.id, email: m.email, role: m.role };
}

export async function setMemberRole(
  db: Db,
  owner: { id: string; role: TeamOwnerRole },
  memberId: string,
  role: string,
) {
  if (!isTeamRole(owner.role, role)) fail("Rôle inconnu.");
  const m = await mine(db, owner.id, memberId);
  if (m.status === "revoked") fail("Ce membre a été retiré de l'équipe.");
  await db.update(teamMembers).set({ role, updatedAt: new Date() }).where(eq(teamMembers.id, m.id));
  await db.insert(auditLogs).values({
    actorId: owner.id,
    module: "team",
    action: `Rôle changé : ${teamRoleLabel(owner.role, m.role)} → ${teamRoleLabel(owner.role, role)}`,
    targetType: "team_member",
    targetId: m.id,
  });
}

/** Retire un membre : invitation annulée, ou compte suspendu (accès coupé). */
export async function removeMember(db: Db, ownerId: string, memberId: string) {
  return db.transaction(async (tx) => {
    const m = await mine(tx, ownerId, memberId);
    if (m.status === "revoked") return;
    await tx
      .update(teamMembers)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(teamMembers.id, m.id));
    if (m.userId) {
      await tx
        .update(users)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(users.id, m.userId));
    }
    await tx.insert(auditLogs).values({
      actorId: ownerId,
      module: "team",
      action: m.userId ? "Membre retiré de l'équipe" : "Invitation annulée",
      targetType: "team_member",
      targetId: m.id,
    });
  });
}

// --- Invitation (côté invité, sans session) --------------------------------------

export type InviteInfo =
  | { valid: true; email: string; roleLabel: string; ownerName: string }
  | { valid: false; reason: "expired" | "used" };

export async function readInvite(q: Q, memberId: string): Promise<InviteInfo> {
  const [m] = await q
    .select({ m: teamMembers, ownerRole: users.role })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.ownerId))
    .where(eq(teamMembers.id, memberId));
  if (!m || m.m.status === "revoked") return { valid: false, reason: "expired" };
  if (m.m.status === "active") return { valid: false, reason: "used" };
  if (m.m.expiresAt.getTime() < Date.now()) return { valid: false, reason: "expired" };
  const people = await loadPeople(q, [m.m.ownerId]);
  return {
    valid: true,
    email: m.m.email,
    roleLabel: teamRoleLabel(m.ownerRole as TeamOwnerRole, m.m.role),
    ownerName: people.get(m.m.ownerId)?.name ?? "l'établissement",
  };
}

/** Crée le compte du membre et l'active dans l'équipe. */
export async function acceptInvite(
  db: Db,
  memberId: string,
  input: { firstName: string; lastName: string; phone: string; passwordHash: string },
): Promise<{ id: string; email: string; role: "restaurant" | "farmer" }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ m: teamMembers, ownerRole: users.role, ownerStatus: users.status })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.ownerId))
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.status, "invited"),
          gt(teamMembers.expiresAt, new Date()),
        ),
      )
      .for("update");
    if (!row) fail("Cette invitation n'est plus valable. Demandez-en une nouvelle.");
    if (row.ownerStatus !== "active") fail("Cet établissement n'est plus actif sur Diambar.");
    if (row.ownerRole !== "restaurant" && row.ownerRole !== "farmer") fail("Invitation invalide.");
    const [taken] = await tx
      .select({ email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.email, row.m.email));
    if (taken) fail("Un compte existe déjà avec cette adresse. Connectez-vous.");
    const [phoneTaken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, input.phone));
    if (phoneTaken) fail("Ce numéro est déjà associé à un compte.");
    const now = new Date();
    const [u] = await tx
      .insert(users)
      .values({
        role: row.ownerRole,
        email: row.m.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        firstName: input.firstName.trim().slice(0, 60),
        lastName: input.lastName.trim().slice(0, 60),
        status: "active",
        // L'adresse est confirmée : l'invitation y a été reçue.
        emailVerifiedAt: now,
        acceptedTermsAt: now,
        passwordChangedAt: now,
      })
      .returning({ id: users.id });
    await tx
      .update(teamMembers)
      .set({ userId: u.id, status: "active", acceptedAt: now, updatedAt: now })
      .where(eq(teamMembers.id, memberId));
    await tx.insert(auditLogs).values({
      actorId: u.id,
      module: "team",
      action: "Invitation acceptée",
      targetType: "user",
      targetId: row.m.ownerId,
    });
    await notifyUser(tx, row.m.ownerId, {
      type: "system",
      title: "Nouveau membre dans votre équipe",
      body: `${input.firstName.trim()} ${input.lastName.trim()} a rejoint votre équipe (${teamRoleLabel(row.ownerRole, row.m.role)}).`,
      link: `/${row.ownerRole}/settings/team`,
    });
    return { id: u.id, email: row.m.email, role: row.ownerRole };
  });
}

// --- Lecture (titulaire) ---------------------------------------------------------

export async function readTeam(
  q: Q,
  owner: { id: string; role: TeamOwnerRole },
): Promise<{ members: TeamMemberView[]; activity: TeamActivity[] }> {
  const rows = await q
    .select({
      m: teamMembers,
      first: users.firstName,
      last: users.lastName,
      lastLoginAt: users.lastLoginAt,
    })
    .from(teamMembers)
    .leftJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.ownerId, owner.id), inArray(teamMembers.status, ["invited", "active"])),
    )
    .orderBy(desc(teamMembers.createdAt));
  const memberUserIds = rows.flatMap((r) => (r.m.userId ? [r.m.userId] : []));
  const logs = memberUserIds.length
    ? await q
        .select({ at: auditLogs.at, actorId: auditLogs.actorId, action: auditLogs.action })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.module, "team"),
            eq(auditLogs.targetId, owner.id),
            inArray(auditLogs.actorId, memberUserIds),
          ),
        )
        .orderBy(desc(auditLogs.at))
        .limit(30)
    : [];
  const nameOf = (r: (typeof rows)[number]) =>
    r.first ? `${r.first} ${r.last ?? ""}`.trim() : "—";
  return {
    members: rows.map((r) => ({
      id: r.m.id,
      name: nameOf(r),
      email: r.m.email,
      role: r.m.role,
      roleLabel: teamRoleLabel(owner.role, r.m.role),
      status: r.m.status,
      expiresAt: r.m.status === "invited" ? r.m.expiresAt.toISOString() : undefined,
      lastLoginAt: r.lastLoginAt?.toISOString(),
    })),
    activity: logs.map((l) => ({
      at: l.at.toISOString(),
      memberName: nameOf(rows.find((r) => r.m.userId === l.actorId)!),
      action: l.action,
    })),
  };
}

/** Trace une action d'un membre sur l'espace du titulaire. */
export async function recordTeamAction(
  q: Q,
  input: { memberUserId: string; ownerId: string; action: string },
) {
  await q.insert(auditLogs).values({
    actorId: input.memberUserId,
    module: "team",
    action: input.action.slice(0, 200),
    targetType: "user",
    targetId: input.ownerId,
  });
}
