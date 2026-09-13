import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  Eye,
  Upload,
  Warehouse,
  ShoppingBag,
  Coins,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { KpiCard } from "@/components/farmer/kpi-card";
import { QuickActions, type QuickAction } from "@/components/farmer/quick-actions";
import { useProducts, productActions } from "@/data/store";
import { type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { CATEGORY_COLOR } from "@/lib/category-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/farmer/products/")({
  head: () => ({ meta: [{ title: "Mes produits · Diambar Agro" }] }),
  component: ProductsPage,
});

const CATEGORIES: Product["category"][] = [
  "Légumes",
  "Fruits",
  "Viande",
  "Volaille",
  "Céréales",
  "Tubercules",
  "Épices",
];

const quickActions: QuickAction[] = [
  { icon: Plus, label: "Ajouter un produit", to: "/farmer/products/new", tone: "emerald" },
  { icon: Warehouse, label: "Gérer le stock", to: "/farmer/stock", tone: "blue" },
  { icon: ShoppingBag, label: "Voir les commandes", to: "/farmer/orders", tone: "violet" },
  { icon: Upload, label: "Importer Excel", to: "/farmer/products/import", tone: "amber" },
];

function ProductsPage() {
  const navigate = useNavigate();
  const all = useProducts();
  const items = all.filter((p) => p.farmerId === "f1");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tab, setTab] = useState<"all" | "active" | "low" | "out" | "draft">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const filtered = useMemo(
    () =>
      items.filter(
        (p) =>
          (q === "" ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.sku.toLowerCase().includes(q.toLowerCase())) &&
          (cat === "all" || p.category === cat) &&
          (tab === "all" || p.status === tab),
      ),
    [items, q, cat, tab],
  );

  const count = (s: typeof tab) =>
    s === "all" ? items.length : items.filter((p) => p.status === s).length;

  const enStock = items.filter((p) => p.stock > 0).length;
  const stockValue = items.reduce((acc, p) => acc + p.stock * p.pricePerKg, 0);

  const categoryCounts = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of items) totals.set(p.category, (totals.get(p.category) ?? 0) + 1);
    return Array.from(totals.entries())
      .map(([category, n]) => ({ category, n }))
      .sort((a, b) => b.n - a.n);
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes produits"
        subtitle={`${items.length} référence(s) · ${count("active")} active(s)`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/farmer/products/import">
                <Upload className="h-4 w-4" />
                Importer Excel
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to="/farmer/products/new">
                <Plus className="h-4 w-4" />
                Ajouter
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Total produits" value={String(items.length)} tone="blue" />
        <KpiCard
          icon={Warehouse}
          label="Produits en stock"
          value={String(enStock)}
          tone="emerald"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Stock faible"
          value={String(count("low"))}
          tone="amber"
        />
        <KpiCard
          icon={Coins}
          label="Valeur du stock"
          value={formatFCFA(stockValue)}
          tone="violet"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un produit ou SKU…"
                className="pl-9"
              />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setView("grid")}
                aria-label="Vue grille"
                className={`grid h-7 w-7 place-items-center rounded-md transition ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                aria-label="Vue liste"
                className={`grid h-7 w-7 place-items-center rounded-md transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
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
            <EmptyState
              icon={Package}
              title="Aucun produit trouvé"
              description="Ajustez vos filtres ou créez un nouveau produit."
              action={
                <Button asChild className="gap-2">
                  <Link to="/farmer/products/new">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Link>
                </Button>
              }
            />
          ) : view === "grid" ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const pct = Math.min(
                  100,
                  Math.round((p.stock / Math.max(1, p.minStock * 2)) * 100),
                );
                return (
                  <div
                    key={p.id}
                    className="relative glass rounded-2xl overflow-hidden group flex flex-col"
                  >
                    <Link
                      to="/farmer/products/$productId"
                      params={{ productId: p.id }}
                      className="relative aspect-[4/3] bg-muted overflow-hidden block"
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute top-2 left-2">
                        <StockStatusBadge status={p.status} />
                      </div>
                      <div className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/60 text-white backdrop-blur px-1.5 py-0.5 rounded">
                        {p.sku}
                      </div>
                    </Link>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold leading-tight">{p.name}</h3>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {p.category}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-lg font-bold text-primary">
                            {formatFCFA(p.pricePerKg)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">/ {p.unit}</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                          <span>
                            Stock · {p.stock} {p.unit}
                          </span>
                          <span>min {p.minStock}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${p.stock === 0 ? "bg-rose-500" : p.stock < p.minStock ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-muted-foreground">
                        {p.ordersThisMonth} commandes ce mois
                      </div>
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <Link to="/farmer/products/$productId" params={{ productId: p.id }}>
                            <Eye className="h-3.5 w-3.5" />
                            Voir
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <Link to="/farmer/products/$productId/edit" params={{ productId: p.id }}>
                            <Pencil className="h-3.5 w-3.5" />
                            Éditer
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs text-rose-500 hover:text-rose-600"
                          onClick={() => setToDelete(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Suppr.
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Prix unitaire</TableHead>
                    <TableHead className="text-right">Stock actuel</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({ to: "/farmer/products/$productId", params: { productId: p.id } })
                      }
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link
                          to="/farmer/products/$productId"
                          params={{ productId: p.id }}
                          className="flex items-center gap-3"
                        >
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: CATEGORY_COLOR[p.category] ?? "#94a3b8" }}
                          />
                          {p.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatFCFA(p.pricePerKg)}/{p.unit}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {p.stock} {p.unit}
                      </TableCell>
                      <TableCell>
                        <StockStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="outline" className="h-8">
                            <Link
                              to="/farmer/products/$productId/edit"
                              params={{ productId: p.id }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-rose-500 hover:text-rose-600"
                            onClick={() => setToDelete(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Catégories</h3>
              {cat !== "all" && (
                <button onClick={() => setCat("all")} className="text-xs text-primary font-medium">
                  Réinitialiser
                </button>
              )}
            </div>
            <ul className="space-y-2.5">
              {categoryCounts.map((c) => (
                <li key={c.category}>
                  <button
                    onClick={() => setCat(c.category)}
                    className={`w-full flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2 transition ${cat === c.category ? "bg-primary/10 text-primary" : "hover:bg-accent/40"}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLOR[c.category] ?? "#94a3b8" }}
                    />
                    <span className="flex-1 text-left truncate">{c.category}</span>
                    <span className="font-semibold">{c.n}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <QuickActions actions={quickActions} />
        </div>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} sera retiré de votre catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  productActions.remove(toDelete.id);
                  toast.success("Supprimé");
                  setToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
