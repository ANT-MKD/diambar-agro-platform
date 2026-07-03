import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Ban, PlayCircle, Trash2, Heart, Phone, Mail, MapPin, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { useSupplier, supplierActions } from "@/data/store";
import { farmers, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/restaurant/suppliers/$supplierId")({
  head: () => ({ meta: [{ title: "Fournisseur · Restaurant" }] }),
  component: SupplierLayout,
});

function SupplierLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { supplierId } = Route.useParams();
  if (path.endsWith("/edit")) return <Outlet />;
  return <SupplierDetail supplierId={supplierId} />;
}

function SupplierDetail({ supplierId }: { supplierId: string }) {
  const nav = useNavigate();
  const s = useSupplier(supplierId);
  if (!s) return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Fournisseur introuvable</div>;
  const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
  const offer = f ? products.filter((p) => p.farmerId === f.id) : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={s.name}
        subtitle={`${s.city} · ${s.contact}`}
        actions={
          <>
            <Button asChild variant="outline" className="gap-2"><Link to="/restaurant/suppliers"><ArrowLeft className="h-4 w-4" />Retour</Link></Button>
            <Button asChild variant="outline" className="gap-2"><Link to="/restaurant/suppliers/$supplierId/edit" params={{ supplierId }}><Pencil className="h-4 w-4" />Modifier</Link></Button>
            <Button variant="outline" className="gap-2" onClick={() => { supplierActions.toggleSuspend(s.id); toast.success(s.suspended ? "Fournisseur réactivé" : "Fournisseur suspendu"); }}>
              {s.suspended ? <><PlayCircle className="h-4 w-4 text-emerald-500" />Réactiver</> : <><Ban className="h-4 w-4 text-destructive" />Suspendre</>}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={() => {
              if (confirm(`Supprimer définitivement ${s.name} ?`)) {
                supplierActions.remove(s.id);
                toast.success("Fournisseur supprimé");
                nav({ to: "/restaurant/suppliers" });
              }
            }}><Trash2 className="h-4 w-4" />Supprimer</Button>
          </>
        }
      />

      {s.suspended && (
        <div className="glass rounded-2xl p-4 border border-destructive/40 bg-destructive/5 text-sm text-destructive">
          Ce fournisseur est actuellement <b>suspendu</b>. Aucune nouvelle commande ne peut lui être passée.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-lg">Informations</h3>
              <button onClick={() => supplierActions.toggleFavorite(s.id)} className="text-xs flex items-center gap-1 hover:text-rose-500 transition"><Heart className={`h-4 w-4 ${s.favorite ? "fill-rose-500 text-rose-500" : ""}`} />{s.favorite ? "Favori" : "Ajouter aux favoris"}</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{s.phone}</span></div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{s.email}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{s.city}</span></div>
              <div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /><span>{offer.length} produits proposés</span></div>
            </div>
            {s.notes && <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground"><b className="text-foreground">Notes: </b>{s.notes}</div>}
          </div>

          {offer.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-bold text-lg mb-3">Catalogue</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {offer.map((p) => (
                  <Link key={p.id} to="/restaurant/marketplace/$productId" params={{ productId: p.id }} className="flex items-center gap-3 p-2 rounded-xl border border-border hover:bg-accent/40 transition">
                    <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1"><div className="font-medium text-sm">{p.name}</div><div className="text-[11px] text-muted-foreground">{formatFCFA(p.pricePerKg)}/{p.unit}</div></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground">STATISTIQUES</div>
            <div><div className="text-3xl font-bold text-primary">{s.totalOrders}</div><div className="text-[11px] text-muted-foreground">Commandes totales</div></div>
            <div><div className="text-2xl font-bold">{formatFCFA(s.totalSpent)}</div><div className="text-[11px] text-muted-foreground">Total dépensé</div></div>
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">Dernière commande : <b className="text-foreground">{s.lastOrder}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}