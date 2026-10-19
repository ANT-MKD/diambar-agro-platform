// Équipes des établissements en base (tests sur une vraie base PostgreSQL,
// fichier « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { teamMembers, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import { teamRoleAllows } from "./team";
import {
  acceptInvite,
  inviteMember,
  readInvite,
  readTeam,
  recordTeamAction,
  removeMember,
  renewInvite,
  setMemberRole,
  teamContextFor,
} from "./team-db.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_team_test";

describe.skipIf(!adminUrl)("équipes des établissements (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let restaurantId: string;
  let farmerId: string;
  let memberId: string;
  let memberUserId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const owner = () => ({ id: restaurantId, role: "restaurant" as const });

  beforeAll(async () => {
    const admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await admin.end();
    const u = new URL(adminUrl!);
    u.pathname = `/${DB_NAME}`;
    ({ db, close } = createDb(u.toString(), { max: 4 }));
    await migrate(db, { migrationsFolder: "supabase/migrations" });
    await seedReference(db);
    await seedDemo(db);
    restaurantId = await idOf("restaurant@diambar.sn");
    farmerId = await idOf("agriculteur@diambar.sn");
  });

  afterAll(async () => {
    await close?.();
  });

  it("droits par rôle : le titulaire garde réglages, retraits et équipe", () => {
    expect(teamRoleAllows("restaurant", "buyer", "order")).toBe(true);
    expect(teamRoleAllows("restaurant", "accountant", "order")).toBe(false);
    expect(teamRoleAllows("restaurant", "accountant", "pay")).toBe(true);
    expect(teamRoleAllows("restaurant", "viewer", "read")).toBe(true);
    expect(teamRoleAllows("restaurant", "viewer", "messages")).toBe(false);
    expect(teamRoleAllows("farmer", "stock", "stock")).toBe(true);
    expect(teamRoleAllows("farmer", "stock", "catalog")).toBe(false);
    for (const cap of ["settings", "payout", "team"] as const) {
      expect(teamRoleAllows("restaurant", "buyer", cap)).toBe(false);
      expect(teamRoleAllows("farmer", "manager", cap)).toBe(false);
    }
    expect(teamRoleAllows("restaurant", "manager", "read")).toBe(false);
  });

  it("invitation : adresse déjà inscrite refusée, doublon refusé, lien valable", async () => {
    await expect(
      inviteMember(db, owner(), { email: "agriculteur@diambar.sn", role: "buyer" }),
    ).rejects.toThrow(/déjà un compte/);
    await expect(
      inviteMember(db, owner(), { email: "chef@exemple.sn", role: "manager" }),
    ).rejects.toThrow(/Rôle/);
    const m = await inviteMember(db, owner(), { email: " Chef@Exemple.sn ", role: "buyer" });
    memberId = m.memberId;
    expect(m.email).toBe("chef@exemple.sn");
    await expect(
      inviteMember(db, owner(), { email: "chef@exemple.sn", role: "chef" }),
    ).rejects.toThrow(/déjà invitée/);
    const info = await readInvite(db, memberId);
    expect(info).toMatchObject({ valid: true, email: "chef@exemple.sn", roleLabel: "Acheteur" });
    // Échue : plus valable, puis renouvelée.
    await db
      .update(teamMembers)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(teamMembers.id, memberId));
    expect(await readInvite(db, memberId)).toMatchObject({ valid: false, reason: "expired" });
    await expect(
      acceptInvite(db, memberId, {
        firstName: "Awa",
        lastName: "Ndiaye",
        phone: "770000123",
        passwordHash: "x",
      }),
    ).rejects.toThrow(/plus valable/);
    await renewInvite(db, restaurantId, memberId);
    expect((await readInvite(db, memberId)).valid).toBe(true);
  });

  it("acceptation : compte du membre créé, rattaché au titulaire", async () => {
    const created = await acceptInvite(db, memberId, {
      firstName: "Awa",
      lastName: "Ndiaye",
      phone: "770000123",
      passwordHash: "hash-du-test",
    });
    memberUserId = created.id;
    expect(created.role).toBe("restaurant");
    const account = await new DbAccountStore(db).findById(created.id);
    expect(account).toMatchObject({ status: "active", role: "restaurant" });
    expect(await teamContextFor(db, created.id)).toEqual({
      memberId,
      ownerId: restaurantId,
      role: "buyer",
    });
    expect(await teamContextFor(db, restaurantId)).toBeNull();
    expect(await readInvite(db, memberId)).toMatchObject({ valid: false, reason: "used" });
  });

  it("actions tracées au nom du membre, rôle modifiable, retrait = accès coupé", async () => {
    await recordTeamAction(db, {
      memberUserId,
      ownerId: restaurantId,
      action: "Commande passée",
    });
    let t = await readTeam(db, owner());
    expect(t.members[0]).toMatchObject({ name: "Awa Ndiaye", role: "buyer", status: "active" });
    expect(t.activity[0]).toMatchObject({ memberName: "Awa Ndiaye", action: "Commande passée" });
    await setMemberRole(db, owner(), memberId, "accountant");
    expect((await teamContextFor(db, memberUserId))?.role).toBe("accountant");
    await expect(setMemberRole(db, owner(), memberId, "stock")).rejects.toThrow(/Rôle/);
    // Un autre établissement ne touche pas à cette équipe.
    await expect(removeMember(db, farmerId, memberId)).rejects.toThrow(/introuvable/);
    await removeMember(db, restaurantId, memberId);
    expect(await teamContextFor(db, memberUserId)).toBeNull();
    const [u] = await db.select().from(users).where(eq(users.id, memberUserId));
    expect(u.status).toBe("suspended");
    t = await readTeam(db, owner());
    expect(t.members).toHaveLength(0);
  });
});
