import { and, desc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { missions, orders, reviews } from "@/db/schema";
import type { Review } from "@/data/business";
import { audit, fail, notifyUser, type Q } from "./market-common.server";
import { loadPeople } from "./people.server";

// Avis après livraison : un par commande livrée, du restaurant sur son
// producteur. Le producteur répond ; l'équipe masque un avis abusif (il n'est
// alors plus montré ni compté).

type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };

export type ReviewInput = {
  orderId: string;
  quality: number;
  quantity: number;
  freshness: number;
  timeliness: number;
  packaging: number;
  communication: number;
  comment: string;
  tags: string[];
};

const SCORES = [
  "quality",
  "quantity",
  "freshness",
  "timeliness",
  "packaging",
  "communication",
] as const;

export async function createReview(db: Db, me: Me, input: ReviewInput): Promise<string> {
  if (me.role !== "restaurant") fail("Seul le restaurant note sa commande.");
  for (const k of SCORES) {
    const v = input[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) fail("Chaque critère se note de 1 à 5.");
  }
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
    if (!o || o.restaurantId !== me.id) fail("Commande introuvable.");
    if (o.status !== "delivered") fail("Une commande se note une fois livrée.");
    const [existing] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.orderId, o.id));
    if (existing) fail("Cette commande a déjà été notée.");
    const [m] = await tx
      .select({ driverId: missions.driverId })
      .from(missions)
      .where(and(eq(missions.orderId, o.id), eq(missions.status, "delivered")));
    const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]
      .slice(0, 8)
      .map((t) => t.slice(0, 40));
    const [r] = await tx
      .insert(reviews)
      .values({
        orderId: o.id,
        restaurantId: me.id,
        farmerId: o.farmerId,
        driverId: m?.driverId ?? null,
        quality: input.quality,
        quantity: input.quantity,
        freshness: input.freshness,
        timeliness: input.timeliness,
        packaging: input.packaging,
        communication: input.communication,
        comment: input.comment.trim().slice(0, 1500),
        tags,
      })
      .returning({ id: reviews.id });
    const avg = SCORES.reduce((s, k) => s + input[k], 0) / SCORES.length;
    await notifyUser(tx, o.farmerId, {
      type: "system",
      title: "Nouvel avis reçu",
      body: `${avg.toFixed(1)}/5 sur ${o.reference}`,
      link: "/farmer/reviews",
    });
    return r.id;
  });
}

export async function replyReview(db: Db, me: Me, id: string, text: string) {
  const reply = text.trim().slice(0, 1000);
  if (reply.length < 2) fail("Écrivez votre réponse.");
  const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
  if (!r || r.farmerId !== me.id) fail("Avis introuvable.");
  await db.update(reviews).set({ reply, repliedAt: new Date() }).where(eq(reviews.id, id));
  await notifyUser(db, r.restaurantId, {
    type: "system",
    title: "Réponse du producteur à votre avis",
    body: reply.slice(0, 140),
    link: "/restaurant/reviews",
  });
}

/** Équipe : masquer (ou réafficher) un avis abusif. */
export async function setReviewHidden(db: Db, staffId: string, id: string, hidden: boolean) {
  const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
  if (!r) fail("Avis introuvable.");
  await db
    .update(reviews)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(eq(reviews.id, id));
  await audit(db, {
    module: "moderation",
    actorId: staffId,
    action: hidden ? "Avis masqué (modération)" : "Avis réaffiché (modération)",
    targetType: "review",
    targetId: id,
  });
}

/** Avis visibles : un restaurant voit les avis de tous (réputation des
 * producteurs) mais seulement les siens en détail ; un producteur les siens ;
 * l'équipe tout, avis masqués compris. */
export async function readReviews(q: Q, me: Me): Promise<Review[]> {
  const staff = me.role === "admin";
  const rows = await q
    .select({ r: reviews, orderRef: orders.reference })
    .from(reviews)
    .innerJoin(orders, eq(orders.id, reviews.orderId))
    .where(
      staff
        ? undefined
        : me.role === "farmer"
          ? and(eq(reviews.farmerId, me.id), isNull(reviews.hiddenAt))
          : me.role === "restaurant"
            ? isNull(reviews.hiddenAt)
            : or(eq(reviews.driverId, me.id)),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(500);
  const people = await loadPeople(
    q,
    rows.flatMap(({ r }) => [r.farmerId, r.driverId, r.restaurantId]),
  );
  return rows.map(({ r, orderRef }) => {
    // Un restaurant ne lit pas les commentaires des autres restaurants :
    // seulement les notes, pour la réputation du producteur.
    const mine = staff || me.role !== "restaurant" || r.restaurantId === me.id;
    return {
      id: r.id,
      orderId: mine ? r.orderId : undefined,
      restaurantId: mine ? r.restaurantId : "",
      orderRef: mine ? orderRef : "",
      supplierId: r.farmerId,
      supplierName: people.get(r.farmerId)?.name ?? "Producteur",
      driverName: r.driverId ? people.get(r.driverId)?.name : undefined,
      quality: r.quality,
      quantity: r.quantity,
      freshness: r.freshness,
      timeliness: r.timeliness,
      packaging: r.packaging,
      communication: r.communication,
      comment: mine ? r.comment : "",
      tags: mine && Array.isArray(r.tags) ? (r.tags as string[]) : [],
      createdAt: r.createdAt.toISOString(),
      reply: r.reply && r.repliedAt ? { at: r.repliedAt.toISOString(), text: r.reply } : undefined,
      ...(staff
        ? {
            restaurantName: people.get(r.restaurantId)?.name,
            hidden: !!r.hiddenAt,
          }
        : {}),
    };
  });
}
