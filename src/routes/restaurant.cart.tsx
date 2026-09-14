import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { CartItemRow } from "@/components/restaurant/cart-item";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import { useCart, useProducts, cartActions } from "@/data/store";
import { farmers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurant/cart")({
  head: () => ({ meta: [{ title: "Panier · Restaurant" }] }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const products = useProducts();
  const lines = cart
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product);

  if (lines.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mon panier" />
        <EmptyState
          icon={ShoppingCart}
          title="Votre panier est vide"
          description="Parcourez la marketplace pour ajouter des produits."
          action={
            <Button asChild>
              <Link to="/restaurant/marketplace">Explorer la marketplace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Group by farmer
  const groups = farmers
    .map((f) => ({ farmer: f, items: lines.filter((l) => l.product.farmerId === f.id) }))
    .filter((g) => g.items.length > 0);

  const subtotal = lines.reduce((s, l) => s + l.product.pricePerKg * l.qty, 0);
  const delivery = Math.round(subtotal * 0.03);
  const total = subtotal + delivery;

  // Suggestions réelles : produits actifs des mêmes catégories que le panier,
  // pas encore dedans — pas une sélection éditoriale inventée.
  const cartCategories = new Set(lines.map((l) => l.product.category));
  const inCart = new Set(lines.map((l) => l.productId));
  const suggestions = products
    .filter((p) => p.status === "active" && cartCategories.has(p.category) && !inCart.has(p.id))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon panier"
        subtitle={`${lines.length} article(s) · ${groups.length} producteur(s)`}
        actions={
          <Button variant="outline" size="sm" onClick={() => cartActions.clear()} className="gap-1">
            <Trash2 className="h-4 w-4" />
            Vider
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {groups.map(({ farmer, items }) => (
            <div key={farmer.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img src={farmer.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{farmer.farm}</div>
                  <div className="text-[11px] text-muted-foreground">{farmer.city}</div>
                </div>
                <span className="text-xs font-semibold text-primary">
                  {formatFCFA(items.reduce((s, l) => s + l.product.pricePerKg * l.qty, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <CartItemRow key={l.productId} product={l.product} qty={l.qty} />
                ))}
              </div>
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-base font-bold">Vous pourriez aussi aimer</h3>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {suggestions.map((p) => (
                  <RestaurantProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 h-fit sticky top-20 space-y-3">
          <h3 className="font-display text-lg font-bold">Récapitulatif</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatFCFA(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frais de livraison</span>
              <span>{formatFCFA(delivery)}</span>
            </div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatFCFA(total)}</span>
            </div>
          </div>
          <Button asChild className="w-full h-11 gap-2 mt-2">
            <Link to="/restaurant/checkout">
              Passer la commande <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Paiement sécurisé via Wave, Orange Money, ou à la livraison.
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-muted-foreground"
          >
            <Link to="/restaurant/returns">
              <Undo2 className="h-3.5 w-3.5" />
              Retours & avoirs
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
