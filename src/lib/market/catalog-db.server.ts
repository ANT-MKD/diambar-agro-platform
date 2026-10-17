import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { auditLogs, categories, farmers, products } from "@/db/schema";
import { categoryNameProblem, cleanCategoryName, sameCategory } from "@/lib/category-name";
import { fail, notifyOpsStaff, notifyUser, type Q, type Tx } from "./market-common.server";
import type { MarketCategory } from "./types";

// Catégories de produits : la liste officielle de l'équipe, plus celles que
// les producteurs proposent en créant un produit. Une catégorie proposée sert
// tout de suite ; l'équipe la garde, la renomme ou la fusionne avec une autre.

export async function readCategories(q: Q): Promise<MarketCategory[]> {
  const rows = await q
    .select({
      id: categories.id,
      name: categories.name,
      status: categories.status,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      proposedBy: farmers.farmName,
      productCount: sql<number>`(select count(*)::int from "products" p where p."category_id" = "categories"."id")`,
    })
    .from(categories)
    .leftJoin(farmers, eq(farmers.userId, categories.createdBy))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    productCount: Number(r.productCount),
    proposedBy: r.status === "proposed" ? (r.proposedBy ?? undefined) : undefined,
    proposedAt: r.status === "proposed" ? r.createdAt?.toISOString() : undefined,
  }));
}

/** Catégorie d'un produit : une existante (même écrite autrement), sinon une
 * nouvelle catégorie proposée par ce producteur. */
export async function resolveCategory(tx: Tx, name: string, farmerId: string): Promise<string> {
  const list = await tx.select({ id: categories.id, name: categories.name }).from(categories);
  const found = sameCategory(name, list);
  if (found) return found.id;
  const problem = categoryNameProblem(name);
  if (problem) fail(problem);
  const clean = cleanCategoryName(name);
  const [farmer] = await tx
    .select({ farmName: farmers.farmName })
    .from(farmers)
    .where(eq(farmers.userId, farmerId));
  const [created] = await tx
    .insert(categories)
    .values({
      name: clean,
      status: "proposed",
      createdBy: farmerId,
      sortOrder: 1000 + list.length,
    })
    .returning({ id: categories.id });
  await notifyOpsStaff(tx, {
    type: "system",
    title: "Nouvelle catégorie proposée",
    body: `« ${clean} », par ${farmer?.farmName || "un producteur"}. À garder, renommer ou fusionner.`,
    link: "/admin/categories",
  });
  return created.id;
}

async function categoryById(q: Q, id: string) {
  const [c] = await q.select().from(categories).where(eq(categories.id, id));
  if (!c) fail("Catégorie introuvable.");
  return c;
}

async function auditCategory(
  q: Q,
  actorId: string,
  action: string,
  targetId: string,
  before: unknown,
  after: unknown,
) {
  await q.insert(auditLogs).values({
    actorId,
    module: "moderation",
    action,
    targetType: "category",
    targetId,
    before,
    after,
  });
}

/** Garder une catégorie proposée : elle devient officielle. */
export async function approveCategory(db: Db, adminId: string, id: string) {
  const c = await categoryById(db, id);
  if (c.status === "approved") return;
  await db.update(categories).set({ status: "approved" }).where(eq(categories.id, id));
  await auditCategory(
    db,
    adminId,
    "Catégorie gardée",
    id,
    { status: c.status },
    {
      name: c.name,
      status: "approved",
    },
  );
}

/** Renommer (faute de frappe, nom plus clair). Le nom ne doit pas doubler
 * une autre catégorie : dans ce cas, fusionner. */
export async function renameCategory(db: Db, adminId: string, id: string, name: string) {
  const problem = categoryNameProblem(name);
  if (problem) fail(problem);
  const clean = cleanCategoryName(name);
  await db.transaction(async (tx) => {
    const c = await categoryById(tx, id);
    const others = (
      await tx.select({ id: categories.id, name: categories.name }).from(categories)
    ).filter((x) => x.id !== id);
    const twin = sameCategory(clean, others);
    if (twin) fail(`« ${twin.name} » existe déjà : fusionnez plutôt les deux catégories.`);
    await tx.update(categories).set({ name: clean }).where(eq(categories.id, id));
    await auditCategory(tx, adminId, "Catégorie renommée", id, { name: c.name }, { name: clean });
  });
}

/** Fusionner une catégorie dans une autre : ses produits y sont déplacés,
 * leurs producteurs prévenus, puis elle disparaît. */
export async function mergeCategory(db: Db, adminId: string, fromId: string, intoId: string) {
  if (fromId === intoId) fail("Choisissez une autre catégorie.");
  return db.transaction(async (tx) => {
    const from = await categoryById(tx, fromId);
    const into = await categoryById(tx, intoId);
    const moved = await tx
      .update(products)
      .set({ categoryId: intoId, updatedAt: new Date() })
      .where(eq(products.categoryId, fromId))
      .returning({ id: products.id, farmerId: products.farmerId, name: products.name });
    await tx.delete(categories).where(and(eq(categories.id, fromId)));
    const byFarmer = new Map<string, string[]>();
    for (const p of moved) byFarmer.set(p.farmerId, [...(byFarmer.get(p.farmerId) ?? []), p.name]);
    for (const [farmerId, names] of byFarmer) {
      await notifyUser(tx, farmerId, {
        type: "stock",
        title: "Catégorie regroupée",
        body: `« ${from.name} » rejoint « ${into.name} » : ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}.`,
        link: "/farmer/products",
      });
    }
    await auditCategory(
      tx,
      adminId,
      "Catégories fusionnées",
      intoId,
      { name: from.name, products: moved.length },
      { name: into.name },
    );
    return moved.length;
  });
}
