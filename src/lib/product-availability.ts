import type { Product } from "@/data/mocks";

export type Orderability = { ok: true } | { ok: false; reason: string };

/** Le produit peut-il être commandé aujourd'hui (et en quelle quantité) ? */
export function productOrderability(p: Product, now = new Date()): Orderability {
  if (p.status === "draft") return { ok: false, reason: "Produit retiré du catalogue" };
  if (p.paused) return { ok: false, reason: "Hors saison pour le moment" };
  if (p.availableFrom && new Date(p.availableFrom) > now) {
    return {
      ok: false,
      reason: `Disponible à partir du ${new Date(p.availableFrom).toLocaleDateString("fr-FR")}`,
    };
  }
  if (p.stock <= 0) return { ok: false, reason: "Rupture de stock" };
  return { ok: true };
}

/** Visible au catalogue : pas les brouillons ni les produits hors saison. */
export function isListed(p: Product) {
  return p.status !== "draft" && !p.paused;
}

export function minOrderOf(p: Product) {
  return Math.max(1, p.minOrder ?? 1);
}
