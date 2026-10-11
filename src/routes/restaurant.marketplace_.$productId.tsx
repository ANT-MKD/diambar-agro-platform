import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import {
  ArrowLeft,
  Star,
  MapPin,
  ShieldCheck,
  Minus,
  Plus,
  ShoppingCart,
  MessageSquare,
  Heart,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useProduct,
  useProducts,
  useProductReviews,
  useAllProductReviews,
  productReviewActions,
  cartActions,
  useWishlist,
  wishlistActions,
  useSuppliers,
  conversationActions,
} from "@/data/store";
import { useReviews as useBusinessReviews } from "@/data/business";
import { farmerReviewStats } from "@/lib/farmer-stats";
import { farmers, restaurants } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { isListed, minOrderOf, productOrderability } from "@/lib/product-availability";

export const Route = createFileRoute("/restaurant/marketplace_/$productId")({
  head: () => ({ meta: [{ title: "Produit · Marketplace" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const { user } = useRouteContext({ from: "/restaurant" });
  const navigate = useNavigate();
  const product = useProduct(productId);
  const all = useProducts();
  const reviews = useProductReviews(productId);
  const allProductReviews = useAllProductReviews();
  const businessReviews = useBusinessReviews();
  const wishlist = useWishlist();
  const suppliers = useSuppliers();
  const [qty, setQty] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  if (!product)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Produit introuvable
      </div>
    );
  const farmer = farmers.find((f) => f.id === product.farmerId);
  const farmerRating = farmer
    ? farmerReviewStats(farmer.id, all, allProductReviews, farmer.rating, businessReviews).avgRating
    : null;
  const out = product.stock === 0;
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const supplierRecord = suppliers.find(
    (s) => s.restaurantId === myRestaurant?.id && s.farmerId === product.farmerId,
  );
  const supplierSuspended = supplierRecord?.suspended ?? false;
  const orderability = productOrderability(product);
  const blocked = !orderability.ok || supplierSuspended;
  const minQty = minOrderOf(product);
  const liked = wishlist.includes(product.id);
  const similar = all
    .filter((p) => p.id !== product.id && p.category === product.category && isListed(p))
    .slice(0, 4);

  const avg =
    reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const description = `${product.category} produite par ${farmer?.farm ?? "un producteur local"}${farmer?.city ? ` à ${farmer.city}` : ""}. ${
    out
      ? "Actuellement en rupture de stock."
      : `${product.stock} ${product.unit} disponible(s) dès maintenant.`
  }`;

  const submitReview = () => {
    if (!reviewText.trim()) {
      toast.error("Décrivez votre expérience avec ce produit");
      return;
    }
    productReviewActions.add({
      productId: product.id,
      restaurantName: user.name,
      rating: reviewRating,
      text: reviewText.trim(),
    });
    toast.success("Avis publié");
    setReviewText("");
    setReviewRating(5);
    setReviewOpen(false);
  };

  const orderNow = () => {
    if (supplierSuspended) {
      toast.error("Ce fournisseur est suspendu dans votre carnet");
      return;
    }
    cartActions.add(product.id, Math.max(qty, minQty));
    navigate({ to: "/restaurant/cart" });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link to="/restaurant/marketplace">
          <ArrowLeft className="h-4 w-4" />
          Marketplace
        </Link>
      </Button>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="relative glass rounded-2xl overflow-hidden aspect-square">
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          <button
            aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
            onClick={() => {
              wishlistActions.toggle(product.id);
              toast.success(liked ? "Retiré des favoris" : "Ajouté aux favoris");
            }}
            className="absolute top-3 right-3 h-10 w-10 grid place-items-center rounded-full bg-background/85 backdrop-blur hover:bg-background transition"
          >
            <Heart className={`h-5 w-5 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
        </div>
        <div className="space-y-5">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {product.category}
            </span>
            <h1 className="font-display text-3xl font-bold mt-1">{product.name}</h1>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold text-primary">
                {formatFCFA(product.pricePerKg)}
              </span>
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${out ? "bg-rose-500/10 text-rose-500" : product.status === "low" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}
            >
              {out
                ? "Rupture"
                : product.status === "low"
                  ? `Stock bas (${product.stock}${product.unit})`
                  : `${product.stock}${product.unit} disponibles`}
            </span>
            <span className="text-muted-foreground">SKU {product.sku}</span>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

          <div className="grid grid-cols-2 gap-3">
            {farmer?.verified && (
              <div className="glass rounded-xl p-3 text-center">
                <ShieldCheck className="h-5 w-5 mx-auto text-primary" />
                <div className="text-[11px] mt-1 text-muted-foreground">Producteur vérifié</div>
              </div>
            )}
            <div className="glass rounded-xl p-3 text-center">
              <Star className="h-5 w-5 mx-auto text-primary" />
              <div className="text-[11px] mt-1 text-muted-foreground">
                {farmerRating != null ? `${farmerRating.toFixed(1)}/5 producteur` : "—"}
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 flex items-center gap-3">
            <img src={farmer?.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="font-semibold text-sm">{farmer?.farm}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {farmer?.city} · {farmer?.products} produits
              </div>
            </div>
            {supplierRecord && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/restaurant/suppliers/$supplierId"
                  params={{ supplierId: supplierRecord.id }}
                >
                  Voir profil
                </Link>
              </Button>
            )}
          </div>

          {supplierSuspended && (
            <div className="glass rounded-xl p-3 border border-destructive/40 bg-destructive/5 text-sm text-destructive">
              Ce fournisseur est suspendu dans votre carnet — impossible de lui commander tant qu'il
              n'est pas réactivé sur sa fiche.
            </div>
          )}

          <div className="space-y-1 text-sm">
            {product.organic && (
              <span className="inline-block rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-xs font-semibold">
                Bio certifié
              </span>
            )}
            {product.description && <p className="text-muted-foreground">{product.description}</p>}
            {minQty > 1 && (
              <p className="text-xs text-muted-foreground">
                Commande minimum : {minQty} {product.unit}
              </p>
            )}
            {!orderability.ok && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {orderability.reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border h-12">
              <button
                onClick={() => setQty(Math.max(minQty, qty - 1))}
                className="h-12 w-12 grid place-items-center hover:bg-accent"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={product.stock}
                aria-label="Quantité"
                value={Math.max(qty, minQty)}
                onChange={(e) =>
                  setQty(
                    Math.max(
                      minQty,
                      Math.min(product.stock, Math.floor(Number(e.target.value) || 1)),
                    ),
                  )
                }
                className="w-16 bg-transparent text-center font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQty(Math.min(product.stock, qty + 1))}
                className="h-12 w-12 grid place-items-center hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              disabled={blocked}
              variant="outline"
              onClick={() => {
                const inCart = cartActions.add(product.id, Math.max(qty, minQty));
                toast.success(
                  inCart < qty
                    ? `Panier plafonné au stock : ${inCart} ${product.unit}`
                    : `${qty} ${product.unit} ajouté(s) au panier`,
                );
              }}
              className="flex-1 h-12 gap-2 text-base"
            >
              <ShoppingCart className="h-5 w-5" /> Ajouter · {formatFCFA(product.pricePerKg * qty)}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={blocked} onClick={orderNow} className="flex-1 h-12 gap-2 text-base">
              <Zap className="h-5 w-5" /> Commander maintenant
            </Button>
            {farmer && myRestaurant && (
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={() => {
                  const conversationId = conversationActions.startOrGet(myRestaurant.id, farmer.id);
                  navigate({
                    to: "/restaurant/messages/$conversationId",
                    params: { conversationId },
                  });
                }}
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            )}
          </div>
        </div>
      </div>

      <section className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-xl font-bold">Avis clients</h2>
          {avg !== null && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                  />
                ))}
              </div>
              <span className="font-bold">{avg.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({reviews.length} avis)</span>
            </div>
          )}
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun avis pour ce produit pour le moment.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{r.restaurantName}</span>
                  <span className="text-[11px] text-muted-foreground">{relativeTime(r.at)}</span>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setReviewOpen(true)}>
          <MessageSquare className="h-3.5 w-3.5" />
          Laisser un avis
        </Button>
      </section>

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold">Produits similaires</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similar.map((p) => (
              <RestaurantProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Laisser un avis — {product.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setReviewRating(s)}>
                  <Star
                    className={`h-6 w-6 ${s <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Votre expérience avec ce produit…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitReview}>Publier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
