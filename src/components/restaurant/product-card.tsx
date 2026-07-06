import { Link } from "@tanstack/react-router";
import { Plus, Star, MapPin, Heart } from "lucide-react";
import { toast } from "sonner";
import { type Product, farmers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { cartActions, useWishlist, wishlistActions } from "@/data/store";

export function RestaurantProductCard({ product }: { product: Product }) {
  const farmer = farmers.find((f) => f.id === product.farmerId);
  const out = product.stock === 0;
  const wishlist = useWishlist();
  const liked = wishlist.includes(product.id);
  return (
    <div className="group glass rounded-2xl overflow-hidden hover:shadow-xl transition flex flex-col">
      <Link to="/restaurant/marketplace/$productId" params={{ productId: product.id }} className="relative block aspect-[4/3] overflow-hidden">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        <span className="absolute top-2 left-2 text-[10px] font-semibold rounded-full bg-background/85 backdrop-blur px-2 py-0.5">{product.category}</span>
        {out && <span className="absolute top-2 right-2 text-[10px] font-semibold rounded-full bg-rose-500 text-white px-2 py-0.5">Rupture</span>}
      </Link>
      <button
        aria-label={liked ? "Retirer des favoris" : "Ajouter aux favoris"}
        onClick={(e) => { e.preventDefault(); wishlistActions.toggle(product.id); toast.success(liked ? "Retiré des favoris" : "Ajouté aux favoris"); }}
        className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-background/85 backdrop-blur hover:bg-background transition"
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
      </button>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link to="/restaurant/marketplace/$productId" params={{ productId: product.id }} className="font-semibold text-sm leading-tight hover:text-primary line-clamp-1">{product.name}</Link>
          <div className="text-right shrink-0">
            <div className="font-display font-bold text-primary">{formatFCFA(product.pricePerKg)}</div>
            <div className="text-[10px] text-muted-foreground">/ {product.unit}</div>
          </div>
        </div>
        {farmer && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <img src={farmer.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
            <span className="truncate">{farmer.farm}</span>
            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{farmer.rating}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{farmer?.city}</span>
          <button
            disabled={out}
            onClick={() => { cartActions.add(product.id, 1); toast.success(`${product.name} ajouté`); }}
            className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
          ><Plus className="h-3.5 w-3.5" />Ajouter</button>
        </div>
      </div>
    </div>
  );
}