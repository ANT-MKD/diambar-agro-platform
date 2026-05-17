import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Package, MoreVertical, Pencil, Trash2, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { useProducts, productActions } from "@/data/store";
import { type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/farmer/products")({
  head: () => ({ meta: [{ title: "Mes produits · Diambar Agro" }] }),
  component: ProductsPage,
});

const CATEGORIES: Product["category"][] = ["Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"];

function ProductsPage() {
  const all = useProducts();
  const items = all.filter((p) => p.farmerId === "f1");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tab, setTab] = useState<"all" | "active" | "low" | "out" | "draft">("all");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => items.filter((p) =>
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())) &&
    (cat === "all" || p.category === cat) &&
    (tab === "all" || p.status === tab)
  ), [items, q, cat, tab]);

  const count = (s: typeof tab) => s === "all" ? items.length : items.filter((p) => p.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes produits"
        subtitle={`${items.length} référence(s) · ${count("active")} active(s)`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2"><Link to="/farmer/products/import"><Upload className="h-4 w-4" />Importer Excel</Link></Button>
            <Button asChild className="gap-2"><Link to="/farmer/products/new"><Plus className="h-4 w-4" />Ajouter</Link></Button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit ou SKU…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Tous ({count("all")})</TabsTrigger>
          <TabsTrigger value="active">Actifs ({count("active")})</TabsTrigger>
          <TabsTrigger value="low">Stock faible ({count("low")})</TabsTrigger>
          <TabsTrigger value="out">Rupture ({count("out")})</TabsTrigger>
          <TabsTrigger value="draft">Brouillons ({count("draft")})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit trouvé" description="Ajustez vos filtres ou créez un nouveau produit." action={<Button asChild className="gap-2"><Link to="/farmer/products/new"><Plus className="h-4 w-4" />Ajouter</Link></Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const pct = Math.min(100, Math.round((p.stock / Math.max(1, p.minStock * 2)) * 100));
            return (
              <div key={p.id} className="glass rounded-2xl overflow-hidden group flex flex-col">
                <Link to="/farmer/products/$productId" params={{ productId: p.id }} className="relative aspect-[4/3] bg-muted overflow-hidden block">
                  <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute top-2 left-2"><StockStatusBadge status={p.status} /></div>
                  <div className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/60 text-white backdrop-blur px-1.5 py-0.5 rounded">{p.sku}</div>
                </Link>
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="grid h-8 w-8 place-items-center rounded-lg bg-background/80 backdrop-blur"><MoreVertical className="h-4 w-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to="/farmer/products/$productId" params={{ productId: p.id }}><Eye className="h-4 w-4 mr-2" />Voir</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/farmer/products/$productId/edit" params={{ productId: p.id }}><Pencil className="h-4 w-4 mr-2" />Modifier</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setToDelete(p)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-bold text-primary">{formatFCFA(p.pricePerKg)}</div>
                      <div className="text-[10px] text-muted-foreground">/ {p.unit}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Stock · {p.stock} {p.unit}</span>
                      <span>min {p.minStock}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${p.stock === 0 ? "bg-rose-500" : p.stock < p.minStock ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">{p.ordersThisMonth} commandes ce mois</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.name} sera retiré de votre catalogue.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDelete) { productActions.remove(toDelete.id); toast.success("Supprimé"); setToDelete(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}