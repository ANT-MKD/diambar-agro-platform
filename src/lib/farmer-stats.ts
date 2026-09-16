import { cityCoords } from "@/lib/tracking/geo";
import { haversineKm } from "@/lib/tracking/geo-math";
import type { Product, ProductReview, RestaurantOrder } from "@/data/mocks";
import { reviewScore, type Review } from "@/data/business";

/** Note + nombre d'avis réels d'un producteur, agrégés depuis les avis
 * produits (marketplace) ET les évaluations post-livraison (page
 * Évaluations) — les deux alimentaient auparavant deux notes différentes
 * et déconnectées pour le même producteur. Se rabat sur la note de base
 * du producteur tant qu'aucun avis n'existe. */
export function farmerReviewStats(
  farmerId: string,
  products: Product[],
  reviews: ProductReview[],
  fallbackRating: number,
  businessReviews: Review[] = [],
): { avgRating: number; reviewCount: number } {
  const farmerProductIds = new Set(
    products.filter((p) => p.farmerId === farmerId).map((p) => p.id),
  );
  const productRatings = reviews
    .filter((r) => farmerProductIds.has(r.productId))
    .map((r) => r.rating);
  const deliveryRatings = businessReviews.filter((r) => r.supplierId === farmerId).map(reviewScore);
  const all = [...productRatings, ...deliveryRatings];
  if (all.length === 0) return { avgRating: fallbackRating, reviewCount: 0 };
  const avgRating = all.reduce((s, v) => s + v, 0) / all.length;
  return { avgRating, reviewCount: all.length };
}

/** Estimation réelle du délai de livraison d'un producteur : basée sur la
 * vraie durée moyenne (commande -> livrée) de ses commandes passées quand
 * il y en a assez pour être significatif, sinon sur la vraie distance à
 * vol d'oiseau entre sa ville et celle du restaurant (jamais un chiffre
 * inventé indépendamment des données). */
export function farmerDeliveryEstimate(
  farmerId: string,
  farmerCity: string,
  restaurantCity: string,
  orders: RestaurantOrder[],
): string {
  const delivered = orders.filter((o) => o.farmerId === farmerId && o.status === "delivered");
  const durationsHours = delivered
    .map((o) => {
      const start = new Date(o.createdAt).getTime();
      const deliveredEvent = o.statusHistory.find((h) => h.status === "delivered");
      if (!deliveredEvent) return null;
      const end = new Date(deliveredEvent.at).getTime();
      return (end - start) / 3600_000;
    })
    .filter((h): h is number => h != null && h >= 0);

  if (durationsHours.length >= 2) {
    const avgHours = durationsHours.reduce((s, h) => s + h, 0) / durationsHours.length;
    if (avgHours <= 30) return "Même jour";
    const days = Math.round(avgHours / 24);
    return days <= 1 ? "1 jour" : `${days - 1}-${days} jours`;
  }

  const distanceKm = haversineKm(cityCoords(farmerCity), cityCoords(restaurantCity));
  if (distanceKm < 20) return "Même jour";
  if (distanceKm < 80) return "1-2 jours";
  return "2-3 jours";
}
