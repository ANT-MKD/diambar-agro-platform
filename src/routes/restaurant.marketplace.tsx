import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Heart, ShoppingCart, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import { useProducts, useWishlist, useCart } from "@/data/store";
import { farmers } from "@/data/mocks";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurant/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace · Restaurant" }] }),
  component: Marketplace,
});

const CATEGORIES = ["Tous", "Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"] as const;
const SORTS = ["Pertinence", "Prix ↑", "Prix ↓", "Stock"] as const;

function Marketplace() {
  const products = useProducts();
  const wishlist = useWishlist();
  const cart = useCart();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Tous");
  const [region, setRegion] = useState<string>("Toutes");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Pertinence");
  const [onlyFav, setOnlyFav] = useState(false);

  const regions = useMemo(() => ["Toutes", ...new Set(farmers.map((f) => f.city))], []);

  const list = useMemo(() => {
    let r = products.filter((p) => p.status !== "draft");
    if (onlyFav) r = r.filter((p) => wishlist.includes(p.id));
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (cat !== "Tous") r = r.filter((p) => p.category === cat);
    if (region !== "Toutes") {
      const ids = farmers.filter((f) => f.city === region).map((f) => f.id);
      r = r.filter((p) => ids.includes(p.farmerId));
    }
    if (sort === "Prix ↑") r = [...r].sort((a, b) => a.pricePerKg - b.pricePerKg);
    if (sort === "Prix ↓") r = [...r].sort((a, b) => b.pricePerKg - a.pricePerKg);
    if (sort === "Stock") r = [...r].sort((a, b) => b.stock - a.stock);
    return r;
  }, [products, q, cat, region, sort, onlyFav, wishlist]);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace" subtitle={`${list.length} produits disponibles auprès de ${farmers.length} producteurs`} />

      {cartCount > 0 && (
        <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-primary/30 bg-primary/5">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center"><ShoppingCart className="h-4 w-4" /></div>
          <div className="flex-1 text-sm"><b>Reprendre votre panier</b> — {cartCount} article(s) en attente</div>
          <Button asChild size="sm" className="gap-1"><Link to="/restaurant/cart">Voir le panier<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
        </div>
      )}

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-60 rounded-xl border border-border bg-muted/40 px-3 h-10">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tomates, oignons, mangues…" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
            {regions.map((r) => <option key={r}>{r}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
            {SORTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setOnlyFav((v) => !v)} className={`h-10 px-3 rounded-xl border inline-flex items-center gap-2 text-sm transition ${onlyFav ? "border-rose-500 bg-rose-500/10 text-rose-500" : "border-border hover:bg-accent"}`}>
            <Heart className={`h-4 w-4 ${onlyFav ? "fill-rose-500" : ""}`} />Favoris{wishlist.length > 0 && <span className="text-[10px]">({wishlist.length})</span>}
          </button>
          <button className="h-10 px-3 rounded-xl border border-border inline-flex items-center gap-2 text-sm"><SlidersHorizontal className="h-4 w-4" />Filtres</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${cat === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>{c}</button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Aucun produit ne correspond aux filtres.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((p) => <RestaurantProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}