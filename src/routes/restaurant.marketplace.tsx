import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { RestaurantProductCard } from "@/components/restaurant/product-card";
import { useProducts } from "@/data/store";
import { farmers } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace · Restaurant" }] }),
  component: Marketplace,
});

const CATEGORIES = ["Tous", "Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"] as const;
const SORTS = ["Pertinence", "Prix ↑", "Prix ↓", "Stock"] as const;

function Marketplace() {
  const products = useProducts();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Tous");
  const [region, setRegion] = useState<string>("Toutes");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Pertinence");

  const regions = useMemo(() => ["Toutes", ...new Set(farmers.map((f) => f.city))], []);

  const list = useMemo(() => {
    let r = products.filter((p) => p.status !== "draft");
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
  }, [products, q, cat, region, sort]);

  return (
    <div className="space-y-6">
      <PageHeader title="Marketplace" subtitle={`${list.length} produits disponibles auprès de ${farmers.length} producteurs`} />

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