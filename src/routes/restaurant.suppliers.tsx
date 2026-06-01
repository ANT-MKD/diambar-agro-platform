import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, MapPin, Heart } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { farmers, suppliers, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurant/suppliers")({
  head: () => ({ meta: [{ title: "Fournisseurs · Restaurant" }] }),
  component: Suppliers,
});

function Suppliers() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mes Fournisseurs" subtitle={`${suppliers.length} producteurs au total · ${suppliers.filter((s) => s.favorite).length} favoris`} />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suppliers.map((s) => {
          const f = farmers.find((x) => x.id === s.id);
          if (!f) return null;
          const offer = products.filter((p) => p.farmerId === f.id);
          return (
            <div key={s.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <img src={f.avatar} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-semibold truncate">{f.farm}</h3>{s.favorite && <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{f.city}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{f.rating} · {f.products} produits</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-bold">{s.totalOrders}</div><div className="text-[10px] text-muted-foreground">Commandes</div></div>
                <div><div className="text-lg font-bold text-primary">{formatFCFA(s.totalSpent).replace(" FCFA", "")}</div><div className="text-[10px] text-muted-foreground">Dépensé</div></div>
                <div><div className="text-lg font-bold">{s.lastOrder.slice(5)}</div><div className="text-[10px] text-muted-foreground">Dernière</div></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {offer.slice(0, 4).map((p) => <span key={p.id} className="text-[10px] rounded-full bg-muted px-2 py-0.5">{p.name}</span>)}
              </div>
              <Button asChild variant="outline" size="sm" className="w-full"><Link to="/restaurant/marketplace">Voir produits</Link></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}