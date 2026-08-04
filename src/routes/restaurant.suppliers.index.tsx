import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Star, MapPin, Heart, Plus, Search, Pencil, Ban, PlayCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { farmers, products } from "@/data/mocks";
import { useSuppliers, supplierActions } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function qualityScore(totalOrders: number, favorite: boolean, suspended: boolean): { score: number; label: string; tone: string } {
  if (suspended) return { score: 0, label: "Suspendu", tone: "bg-rose-500/10 text-rose-500" };
  const base = Math.min(100, 55 + totalOrders * 2 + (favorite ? 15 : 0));
  const label = base >= 90 ? "Excellent" : base >= 75 ? "Fiable" : base >= 60 ? "Correct" : "À surveiller";
  const tone = base >= 90 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : base >= 75 ? "bg-blue-500/10 text-blue-500" : base >= 60 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-rose-500/10 text-rose-500";
  return { score: base, label, tone };
}

export const Route = createFileRoute("/restaurant/suppliers/")({
  head: () => ({ meta: [{ title: "Fournisseurs · Restaurant" }] }),
  component: SuppliersLayout,
});

function SuppliersLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path !== "/restaurant/suppliers") return <Outlet />;
  return <SuppliersList />;
}

function SuppliersList() {
  const suppliers = useSuppliers();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "favorites" | "suspended">("all");

  const filtered = useMemo(() => {
    return suppliers
      .filter((s) => (tab === "favorites" ? s.favorite : tab === "suspended" ? s.suspended : true))
      .filter((s) => `${s.name} ${s.contact} ${s.city}`.toLowerCase().includes(q.toLowerCase()));
  }, [suppliers, q, tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes Fournisseurs"
        subtitle={`${suppliers.length} au total · ${suppliers.filter((s) => s.favorite).length} favoris · ${suppliers.filter((s) => s.suspended).length} suspendus`}
        actions={
          <Button asChild className="gap-2"><Link to="/restaurant/suppliers/new"><Plus className="h-4 w-4" />Nouveau fournisseur</Link></Button>
        }
      />

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un fournisseur…" className="pl-9" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(["all", "favorites", "suspended"] as const).map((s) => (
            <button key={s} onClick={() => setTab(s)} className={`px-3 py-1.5 rounded-lg font-medium transition ${tab === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}>
              {s === "all" ? "Tous" : s === "favorites" ? "Favoris" : "Suspendus"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Aucun fournisseur trouvé.
          </div>
        )}
        {filtered.map((s) => {
          const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
          const offer = f ? products.filter((p) => p.farmerId === f.id) : [];
          return (
            <div key={s.id} className={`glass rounded-2xl p-5 space-y-3 relative ${s.suspended ? "opacity-60" : ""}`}>
              {s.suspended && <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">SUSPENDU</span>}
              <div className="flex items-start gap-3">
                <img src={f?.avatar ?? "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200"} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-semibold truncate">{s.name}</h3>{s.favorite && <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city}</div>
                  {f && <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating} · {f.products} produits</div>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{s.totalOrders}</div><div className="text-[10px] text-muted-foreground">Commandes</div></div>
                <div><div className="text-lg font-bold text-primary">{formatFCFA(s.totalSpent).replace(" FCFA", "")}</div><div className="text-[10px] text-muted-foreground">Dépensé</div></div>
                <div><div className="text-lg font-bold">{s.lastOrder.slice(5)}</div><div className="text-[10px] text-muted-foreground">Dernière</div></div>
              </div>
              {(() => {
                const q = qualityScore(s.totalOrders, s.favorite, s.suspended);
                return (
                  <div className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs font-semibold ${q.tone}`}>
                    <span>Score qualité · {q.label}</span>
                    <span className="font-bold">{q.score}/100</span>
                  </div>
                );
              })()}
              {offer.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {offer.slice(0, 4).map((p) => <span key={p.id} className="text-[10px] rounded-full bg-muted px-2 py-0.5">{p.name}</span>)}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="flex-1"><Link to="/restaurant/suppliers/$supplierId" params={{ supplierId: s.id }}>Détail</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/restaurant/suppliers/$supplierId/edit" params={{ supplierId: s.id }}><Pencil className="h-3.5 w-3.5" /></Link></Button>
                <Button variant="outline" size="sm" onClick={() => supplierActions.toggleSuspend(s.id)}>{s.suspended ? <PlayCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Ban className="h-3.5 w-3.5 text-destructive" />}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}