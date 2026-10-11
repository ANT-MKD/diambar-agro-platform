import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ArrowRight, ShoppingCart, Trash2, Undo2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { CartItemRow } from "@/components/restaurant/cart-item";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import {
  useCart,
  useProducts,
  cartActions,
  useSuppliers,
  useRestaurantProfile,
} from "@/data/store";
import { useDeliveryZones } from "@/data/platform-settings";
import { deliveryFeeForZone, zoneForAddress } from "@/lib/pricing";
import { farmers, restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurant/cart")({
  head: () => ({ meta: [{ title: "Panier · Restaurant" }] }),
  component: CartPage,
});

function CartPage() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const suppliers = useSuppliers();
  const suspendedFarmerIds = new Set(
    suppliers
      .filter((s) => s.restaurantId === myRestaurant?.id && s.suspended)
      .map((s) => s.farmerId),
  );
  const cart = useCart();
  const products = useProducts();
  const lines = cart
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product);

  const profile = useRestaurantProfile();
  const zones = useDeliveryZones();
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
  const zone = zoneForAddress(zones, profile.city, profile.deliveryAddress);
  // Frais de la zone réglés par l'admin, une livraison par producteur.
  const producerCount = new Set(
    cart.map((l) => products.find((p) => p.id === l.productId)?.farmerId).filter(Boolean),
  ).size;
  const delivery = zone ? deliveryFeeForZone(zone) * producerCount : 0;
  const total = subtotal + delivery;
  const hasSuspendedSupplier = lines.some((l) => suspendedFarmerIds.has(l.product.farmerId));

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
          {groups.map(({ farmer, items }) => {
            const suspended = suspendedFarmerIds.has(farmer.id);
            return (
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
                {suspended && (
                  <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-medium text-destructive bg-destructive/5 border border-destructive/30">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Fournisseur suspendu dans votre carnet — retirez ces produits avant de
                    commander.
                  </div>
                )}
                <div className="space-y-2">
                  {items.map((l) => (
                    <CartItemRow key={l.productId} product={l.product} qty={l.qty} />
                  ))}
                </div>
              </div>
            );
          })}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-base font-bold">Vous pourriez aussi aimer</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
          {hasSuspendedSupplier ? (
            <Button disabled className="w-full h-11 gap-2 mt-2">
              Passer la commande <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild className="w-full h-11 gap-2 mt-2">
              <Link to="/restaurant/checkout">
                Passer la commande <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {hasSuspendedSupplier && (
            <p className="text-[11px] text-destructive text-center">
              Retirez les produits d'un fournisseur suspendu pour continuer.
            </p>
          )}
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
