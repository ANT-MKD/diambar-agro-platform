import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Heart, ShoppingCart, ArrowRight, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/farmer/page-header";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import { useProducts, useWishlist, useCart, useRestaurantOrders } from "@/data/store";
import { farmers } from "@/data/mocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/restaurant/marketplace")({
  validateSearch: z.object({ supplier: z.string().optional() }),
  head: () => ({ meta: [{ title: "Marketplace · Restaurant" }] }),
  component: Marketplace,
});

const CATEGORIES = [
  "Légumes",
  "Fruits",
  "Viande",
  "Volaille",
  "Céréales",
  "Tubercules",
  "Épices",
] as const;
const SORTS = ["Pertinence", "Meilleures ventes", "Prix ↑", "Prix ↓", "Stock"] as const;
const AVAILABILITY = [
  { key: "active" as const, label: "En stock" },
  { key: "low" as const, label: "Stock faible" },
  { key: "out" as const, label: "Rupture de stock" },
];

function Marketplace() {
  const { supplier: supplierParam } = Route.useSearch();
  const products = useProducts();
  const wishlist = useWishlist();
  const cart = useCart();
  const orders = useRestaurantOrders();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState<string>("Toutes");
  const [supplier, setSupplier] = useState<string>(supplierParam ?? "Tous");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Pertinence");
  const [onlyFav, setOnlyFav] = useState(false);
  const [availability, setAvailability] = useState<Set<"active" | "low" | "out">>(
    new Set(["active", "low", "out"]),
  );
  const [minRating, setMinRating] = useState(0);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showFilters, setShowFilters] = useState(!!supplierParam);

  const catalog = useMemo(() => products.filter((p) => p.status !== "draft"), [products]);
  const regions = useMemo(() => ["Toutes", ...new Set(farmers.map((f) => f.city))], []);
  const priceBounds = useMemo(() => {
    if (catalog.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...catalog.map((p) => p.pricePerKg)),
      max: Math.max(...catalog.map((p) => p.pricePerKg)),
    };
  }, [catalog]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of catalog) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return counts;
  }, [catalog]);

  // "Meilleures ventes" = quantité réellement commandée par ce restaurant,
  // agrégée depuis ses vraies commandes (pas un compteur inventé).
  const salesQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      for (const it of o.items) m.set(it.productId, (m.get(it.productId) ?? 0) + it.qty);
    }
    return m;
  }, [orders]);

  const toggleCat = (c: string) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  const toggleAvailability = (k: "active" | "low" | "out") =>
    setAvailability((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const list = useMemo(() => {
    let r = catalog;
    if (onlyFav) r = r.filter((p) => wishlist.includes(p.id));
    if (q) r = r.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (cats.size > 0) r = r.filter((p) => cats.has(p.category));
    if (region !== "Toutes") {
      const ids = farmers.filter((f) => f.city === region).map((f) => f.id);
      r = r.filter((p) => ids.includes(p.farmerId));
    }
    if (supplier !== "Tous") r = r.filter((p) => p.farmerId === supplier);
    r = r.filter((p) => availability.has(p.status as "active" | "low" | "out"));
    if (minRating > 0) {
      r = r.filter((p) => {
        const f = farmers.find((x) => x.id === p.farmerId);
        return (f?.rating ?? 0) >= minRating;
      });
    }
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (priceMin && Number.isFinite(min)) r = r.filter((p) => p.pricePerKg >= min);
    if (priceMax && Number.isFinite(max)) r = r.filter((p) => p.pricePerKg <= max);
    if (sort === "Prix ↑") r = [...r].sort((a, b) => a.pricePerKg - b.pricePerKg);
    if (sort === "Prix ↓") r = [...r].sort((a, b) => b.pricePerKg - a.pricePerKg);
    if (sort === "Stock") r = [...r].sort((a, b) => b.stock - a.stock);
    if (sort === "Meilleures ventes")
      r = [...r].sort((a, b) => (salesQty.get(b.id) ?? 0) - (salesQty.get(a.id) ?? 0));
    return r;
  }, [
    catalog,
    q,
    cats,
    region,
    supplier,
    sort,
    onlyFav,
    wishlist,
    availability,
    minRating,
    priceMin,
    priceMax,
    salesQty,
  ]);

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  const resetFilters = () => {
    setCats(new Set());
    setRegion("Toutes");
    setSupplier("Tous");
    setAvailability(new Set(["active", "low", "out"]));
    setMinRating(0);
    setPriceMin("");
    setPriceMax("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        subtitle={`${list.length} produit(s) disponible(s) auprès de ${farmers.length} producteurs`}
      />

      {cartCount > 0 && (
        <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-primary/30 bg-primary/5">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm">
            <b>Reprendre votre panier</b> — {cartCount} article(s) en attente
          </div>
          <Button asChild size="sm" className="gap-1">
            <Link to="/restaurant/cart">
              Voir le panier
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-60 rounded-xl border border-border bg-muted/40 px-3 h-10">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tomates, oignons, mangues…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setOnlyFav((v) => !v)}
          className={`h-10 px-3 rounded-xl border inline-flex items-center gap-2 text-sm transition ${onlyFav ? "border-rose-500 bg-rose-500/10 text-rose-500" : "border-border hover:bg-accent"}`}
        >
          <Heart className={`h-4 w-4 ${onlyFav ? "fill-rose-500" : ""}`} />
          Favoris{wishlist.length > 0 && <span className="text-[10px]">({wishlist.length})</span>}
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`h-10 px-3 rounded-xl border inline-flex items-center gap-2 text-sm lg:hidden ${showFilters ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </button>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside
          className={`glass rounded-2xl p-4 space-y-5 h-fit ${showFilters ? "" : "hidden lg:block"}`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Filtres</h3>
            <button onClick={resetFilters} className="text-xs text-primary hover:underline">
              Réinitialiser
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Catégorie
            </div>
            {CATEGORIES.filter((c) => categoryCounts[c]).map((c) => (
              <label key={c} className="flex items-center justify-between text-sm cursor-pointer">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cats.has(c)}
                    onChange={() => toggleCat(c)}
                    className="rounded"
                  />
                  {c}
                </span>
                <span className="text-xs text-muted-foreground">{categoryCounts[c]}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Prix (FCFA/kg)
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={String(priceBounds.min)}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-9 text-sm"
              />
              <span className="text-muted-foreground text-xs">à</span>
              <Input
                type="number"
                placeholder={String(priceBounds.max)}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Disponibilité
            </div>
            {AVAILABILITY.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={availability.has(a.key)}
                  onChange={() => toggleAvailability(a.key)}
                  className="rounded"
                />
                {a.label}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Fournisseur
            </div>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-2 text-sm"
            >
              <option value="Tous">Tous les fournisseurs</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farm}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Note minimum
            </div>
            <div className="flex gap-1">
              {[0, 3, 4, 4.5].map((v) => (
                <button
                  key={v}
                  onClick={() => setMinRating(v)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium inline-flex items-center justify-center gap-1 ${minRating === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                >
                  {v === 0 ? (
                    "Tous"
                  ) : (
                    <>
                      <Star className="h-3 w-3 fill-current" />
                      {v}+
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div>
          {list.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
              Aucun produit ne correspond aux filtres.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((p) => (
                <RestaurantProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
