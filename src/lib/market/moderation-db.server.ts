import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  adminProfiles,
  farmers,
  files,
  moderationEvents,
  productPhotos,
  productReports,
  products,
  users,
} from "@/db/schema";
import type { ModerationItem } from "@/data/admin-mocks";
import { audit, fail, notifyOpsStaff, notifyUser, type Q, type Tx } from "./market-common.server";
import { loadPeople } from "./people.server";
import { publicUrl } from "./storage.server";

// Modération du catalogue : un restaurant signale un produit, l'équipe
// (super admin, opérations) le garde, demande une modification, le retire du
// catalogue ou suspend le producteur. Chaque décision reste dans l'historique
// du produit et au journal d'audit.

export const MODERATION_STAFF = ["super_admin", "operations"] as const;

export async function reportProduct(db: Db, reporterId: string, productId: string, reason: string) {
  const why = reason.trim().slice(0, 300);
  if (why.length < 5) fail("Expliquez le problème (5 caractères minimum).");
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId));
    if (!p || p.status === "draft") fail("Produit introuvable.");
    const [already] = await tx
      .select({ id: productReports.id })
      .from(productReports)
      .where(
        and(
          eq(productReports.productId, productId),
          eq(productReports.reporterId, reporterId),
          eq(productReports.status, "open"),
        ),
      );
    if (already) fail("Vous avez déjà signalé ce produit : l'équipe l'examine.");
    await tx.insert(productReports).values({ productId, reporterId, reason: why });
    await notifyOpsStaff(tx, {
      type: "system",
      title: "Produit signalé",
      body: `${p.name} : ${why.slice(0, 100)}`,
      link: `/admin/moderation`,
    });
  });
}

export type ModerationAction = "keep" | "unpublish" | "request_change" | "suspend_farmer";

async function event(tx: Tx, productId: string, actorId: string, text: string) {
  await tx.insert(moderationEvents).values({ productId, actorId, text });
}

export async function moderateProduct(
  db: Db,
  staffId: string,
  productId: string,
  action: ModerationAction,
  note = "",
) {
  const why = note.trim().slice(0, 500);
  if (action === "request_change" && why.length < 5) fail("Précisez la modification attendue.");
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId));
    if (!p) fail("Produit introuvable.");
    const resolveReports = async () => {
      await tx
        .update(productReports)
        .set({ status: "resolved", resolvedBy: staffId, resolvedAt: new Date() })
        .where(and(eq(productReports.productId, productId), eq(productReports.status, "open")));
    };
    if (action === "keep") {
      await resolveReports();
      await event(tx, productId, staffId, `Produit conservé${why ? ` — ${why}` : ""}`);
    } else if (action === "unpublish") {
      await tx
        .update(products)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(products.id, productId));
      await resolveReports();
      await event(tx, productId, staffId, `Produit retiré du catalogue${why ? ` — ${why}` : ""}`);
      await notifyUser(tx, p.farmerId, {
        type: "system",
        title: "Produit retiré du catalogue",
        body: `« ${p.name} » a été retiré par la modération${why ? ` : ${why}` : ""}. Corrigez-le puis republiez-le.`,
        link: `/farmer/products/${p.id}`,
      });
    } else if (action === "request_change") {
      await event(tx, productId, staffId, `Modification demandée — ${why}`);
      await notifyUser(tx, p.farmerId, {
        type: "system",
        title: "Modification demandée",
        body: `« ${p.name} » : ${why}`,
        link: `/farmer/products/${p.id}`,
      });
    } else {
      // Suspension : tout le compte du producteur, pas seulement ce produit.
      const [prof] = await tx
        .select({ role: adminProfiles.adminRole })
        .from(adminProfiles)
        .where(eq(adminProfiles.userId, p.farmerId));
      if (prof) fail("Compte de l'équipe : impossible ici.");
      await tx
        .update(users)
        .set({ status: "suspended", updatedAt: new Date() })
        .where(eq(users.id, p.farmerId));
      // Ses produits sortent du catalogue tant que le compte est suspendu.
      await resolveReports();
      await event(tx, productId, staffId, `Producteur suspendu${why ? ` — ${why}` : ""}`);
    }
    await audit(tx, {
      module: "moderation",
      actorId: staffId,
      action:
        action === "keep"
          ? "Produit conservé (modération)"
          : action === "unpublish"
            ? "Produit retiré du catalogue (modération)"
            : action === "request_change"
              ? "Modification demandée (modération)"
              : "Producteur suspendu (modération)",
      targetType: action === "suspend_farmer" ? "user" : "product",
      targetId: action === "suspend_farmer" ? p.farmerId : p.id,
      after: why ? { note: why } : undefined,
    });
  });
}

/** File de modération : produits signalés (en cours ou traités récemment). */
export async function readModeration(q: Q): Promise<ModerationItem[]> {
  const reports = await q
    .select()
    .from(productReports)
    .orderBy(desc(productReports.createdAt))
    .limit(500);
  const ids = [...new Set(reports.map((r) => r.productId))];
  if (!ids.length) return [];
  const [rows, photos, events] = await Promise.all([
    q
      .select({ p: products, farmName: farmers.farmName })
      .from(products)
      .innerJoin(farmers, eq(farmers.userId, products.farmerId))
      .where(inArray(products.id, ids)),
    q
      .select({ productId: productPhotos.productId, key: files.storageKey })
      .from(productPhotos)
      .innerJoin(files, eq(files.id, productPhotos.fileId))
      .where(inArray(productPhotos.productId, ids))
      .orderBy(asc(productPhotos.position)),
    q
      .select()
      .from(moderationEvents)
      .where(inArray(moderationEvents.productId, ids))
      .orderBy(asc(moderationEvents.createdAt)),
  ]);
  const people = await loadPeople(q, [
    ...reports.map((r) => r.reporterId),
    ...events.map((e) => e.actorId),
  ]);
  return rows.map(({ p, farmName }) => {
    const mine = reports.filter((r) => r.productId === p.id);
    const open = mine.some((r) => r.status === "open");
    const photo = photos.find((x) => x.productId === p.id);
    return {
      id: p.id,
      productId: p.id,
      name: p.name,
      farmer: farmName,
      image: (photo && publicUrl(photo.key)) || "",
      price: p.price,
      reports: mine.map((r) => ({
        by: people.get(r.reporterId)?.name ?? "Restaurant",
        reason: r.reason,
        at: r.createdAt.toISOString(),
      })),
      status: open ? "pending" : p.status === "draft" ? "removed" : "approved",
      events: events
        .filter((e) => e.productId === p.id)
        .map((e) => ({
          at: e.createdAt.toISOString(),
          actor: people.get(e.actorId ?? "")?.name ?? "Équipe",
          label: e.text,
        })),
    } satisfies ModerationItem;
  });
}
