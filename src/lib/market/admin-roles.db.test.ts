// Rôles de l'administration en base (tests sur une vraie base PostgreSQL,
// fichier « .db ») : ne tourne que si TEST_DATABASE_URL est défini.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/db/client.server";
import { adminProfiles, users } from "@/db/schema";
import { seedDemo, seedReference } from "@/db/seed";
import { PERMISSION_KEYS } from "@/lib/auth/permissions";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import {
  assignAdminRole,
  createAdminRole,
  deleteAdminRole,
  readAdminRoles,
  setAdminTeam,
  updateAdminRole,
} from "./admin-roles-db.server";
import { hasPermission, staffWithPermission } from "./market-common.server";

const adminUrl = process.env.TEST_DATABASE_URL;
const DB_NAME = "diambar_roles_test";

describe.skipIf(!adminUrl)("rôles de l'administration (base)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let superId: string;
  let financeId: string;
  let opsId: string;
  let chiefRoleId: string;

  const idOf = async (email: string) =>
    (await db.select().from(users).where(eq(users.email, email)))[0].id;
  const account = async (id: string) => (await new DbAccountStore(db).findById(id))!;
  const roleNamed = async (name: string) =>
    (await readAdminRoles(db)).find((r) => r.name === name)!;

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
    superId = await idOf("admin@diambar.sn");
    financeId = await idOf("finance@diambar.sn");
    opsId = await idOf("ops@diambar.sn");
  });

  afterAll(async () => {
    await close?.();
  });

  it("rôles fournis par la migration ; permissions lues avec le compte", async () => {
    const roles = await readAdminRoles(db);
    expect(roles.map((r) => r.name)).toEqual(["Opérations", "Finance", "Support", "Modération"]);
    expect(roles.every((r) => r.system)).toBe(true);
    expect(roles.find((r) => r.name === "Finance")?.members).toBe(1);
    const sup = await account(superId);
    expect(sup.staffRoleName).toBe("Super Administrateur");
    expect(sup.permissions).toEqual(PERMISSION_KEYS);
    const fin = await account(financeId);
    expect(fin.staffRoleName).toBe("Finance");
    expect(fin.permissions).toContain("finance.edit");
    expect(fin.permissions).not.toContain("disputes.decide");
    // Profil sans rôle enregistré (ancien) : celui du même nom système.
    await db.update(adminProfiles).set({ roleId: null }).where(eq(adminProfiles.userId, opsId));
    expect((await account(opsId)).staffRoleName).toBe("Opérations");
  });

  it("créer un rôle : réservé à « Créer et modifier les rôles », nom unique", async () => {
    const ops = await account(opsId);
    await expect(
      createAdminRole(db, ops, { name: "Essai", description: "", permissions: ["users.view"] }),
    ).rejects.toThrow(/ne permet pas/);
    const sup = await account(superId);
    await expect(
      createAdminRole(db, sup, {
        name: "super administrateur",
        description: "",
        permissions: ["users.view"],
      }),
    ).rejects.toThrow(/réservé/);
    await expect(
      createAdminRole(db, sup, { name: "finance", description: "", permissions: ["users.view"] }),
    ).rejects.toThrow(/déjà ce nom/);
    await expect(
      createAdminRole(db, sup, { name: "Vide", description: "", permissions: ["inconnue"] }),
    ).rejects.toThrow(/au moins une permission/);
    const chief = await createAdminRole(db, sup, {
      name: "Chef d'équipe",
      description: "Gère les rôles de son équipe",
      permissions: ["users.view", "orders.view", "security.manage_roles", "security.manage_admins"],
    });
    chiefRoleId = chief.id;
    expect((await roleNamed("Chef d'équipe")).permissions).toEqual([
      "users.view",
      "orders.view",
      "security.manage_admins",
      "security.manage_roles",
    ]);
  });

  it("attribuer un rôle : les permissions du compte suivent, côté serveur", async () => {
    const sup = await account(superId);
    await assignAdminRole(db, sup, opsId, { roleId: chiefRoleId });
    const ops = await account(opsId);
    expect(ops.staffRoleName).toBe("Chef d'équipe");
    expect(await hasPermission(db, opsId, "orders.manage")).toBe(false);
    expect(await hasPermission(db, opsId, "security.manage_roles")).toBe(true);
    expect(await staffWithPermission(db, "orders.manage")).toEqual([superId]);
    expect((await staffWithPermission(db, "orders.view")).sort()).toEqual(
      [superId, financeId, opsId].sort(),
    );
  });

  it("pas d'élévation de droits : on ne donne que ce que l'on a, jamais son propre rôle", async () => {
    const chief = await account(opsId);
    await expect(
      createAdminRole(db, chief, {
        name: "Caisse",
        description: "",
        permissions: ["users.view", "finance.edit"],
      }),
    ).rejects.toThrow(/permission que votre propre rôle n'a pas/);
    const helper = await createAdminRole(db, chief, {
      name: "Assistant",
      description: "",
      permissions: ["users.view"],
    });
    await expect(
      updateAdminRole(db, chief, chiefRoleId, {
        name: "Chef d'équipe",
        description: "",
        permissions: [...PERMISSION_KEYS],
      }),
    ).rejects.toThrow(/propre rôle/);
    await expect(
      updateAdminRole(db, chief, helper.id, {
        name: "Assistant",
        description: "",
        permissions: ["users.view", "refunds.execute"],
      }),
    ).rejects.toThrow(/permission que votre propre rôle n'a pas/);
    // Donner le rôle Finance (plus de droits que le sien) : refusé.
    const finance = await roleNamed("Finance");
    await expect(assignAdminRole(db, chief, financeId, { roleId: finance.id })).rejects.toThrow(
      /permission que votre propre rôle n'a pas/,
    );
    await expect(assignAdminRole(db, chief, opsId, { roleId: helper.id })).rejects.toThrow(
      /propre rôle/,
    );
    await expect(assignAdminRole(db, chief, financeId, { superAdmin: true })).rejects.toThrow(
      /super admin/,
    );
    await expect(assignAdminRole(db, chief, superId, { roleId: helper.id })).rejects.toThrow(
      /super admin/,
    );
    // Un rôle fourni garde son nom.
    const sup = await account(superId);
    await expect(
      updateAdminRole(db, sup, finance.id, {
        name: "Trésorerie",
        description: "",
        permissions: finance.permissions,
      }),
    ).rejects.toThrow(/nom d'un rôle fourni/);
  });

  it("supprimer : jamais un rôle fourni ni un rôle encore attribué ; un super admin reste", async () => {
    const sup = await account(superId);
    const finance = await roleNamed("Finance");
    await expect(deleteAdminRole(db, sup, finance.id)).rejects.toThrow(/fourni/);
    await expect(deleteAdminRole(db, sup, chiefRoleId)).rejects.toThrow(/administrateur\(s\)/);
    await expect(assignAdminRole(db, sup, superId, { roleId: finance.id })).rejects.toThrow(
      /propre rôle/,
    );
    // Passer ops en super admin, puis rendre l'ancien super admin « Finance ».
    await assignAdminRole(db, sup, opsId, { superAdmin: true });
    expect((await account(opsId)).permissions).toEqual(PERMISSION_KEYS);
    await assignAdminRole(db, await account(opsId), superId, { roleId: finance.id });
    expect((await account(superId)).staffRoleName).toBe("Finance");
    await expect(
      assignAdminRole(db, await account(financeId), opsId, { roleId: finance.id }),
    ).rejects.toThrow(/ne permet pas/);
    await deleteAdminRole(db, await account(opsId), chiefRoleId);
    expect((await readAdminRoles(db)).some((r) => r.id === chiefRoleId)).toBe(false);
  });

  it("équipe d'un administrateur : regroupement libre", async () => {
    const boss = await account(opsId);
    await setAdminTeam(db, boss, financeId, "  Direction   financière ");
    const [p] = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, financeId));
    expect(p.team).toBe("Direction financière");
    await setAdminTeam(db, boss, financeId, "");
    const [q] = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, financeId));
    expect(q.team).toBeNull();
  });
});
