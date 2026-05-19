import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Warehouse, AlertTriangle, XCircle, Coins, Plus, Minus, ClipboardList, History, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { SidePanel } from "@/components/farmer/side-panel";
import { useProducts } from "@/data/store";
import { type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/farmer/stock")({
  head: () => ({ meta: [{ title: "Stock · Diambar Agro" }] }),
  component: StockPage,
});

function StockPage() {
  const all = useProducts();
  const items = all.filter((p) => p.farmerId === "f1");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);

  const filtered = useMemo(() =>
    items.filter((p) =>
      (filter === "all" || p.status === filter) &&
      (cat === "all" || p.category === cat) &&
      (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
    )
  , [items, filter, cat, q]);

  const totalValue = items.reduce((acc, p) => acc + p.stock * p.pricePerKg, 0);
  const lowCount = items.filter((p) => p.status === "low").length;
  const outCount = items.filter((p) => p.status === "out").length;

  const exportCsv = () => {
    const rows = [["sku", "nom", "categorie", "stock", "min", "prix", "valeur", "statut"]];
    items.forEach((p) => rows.push([p.sku, p.name, p.category, String(p.stock), String(p.minStock), String(p.pricePerKg), String(p.stock * p.pricePerKg), p.status]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "stock-diambar.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success(`${items.length} ligne(s) exportée(s)`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du stock"
        subtitle="Suivi et ajustement de vos références"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2"><Link to="/farmer/stock/inventory"><ClipboardList className="h-4 w-4" />Inventaire</Link></Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
            <Button asChild className="gap-2"><Link to="/farmer/stock/movement/new" search={{}}><Plus className="h-4 w-4" />Mouvement</Link></Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Warehouse} label="Références totales" value={String(items.length)} tone="blue" />
        <KpiCard icon={AlertTriangle} label="Stock faible" value={String(lowCount)} tone="amber" />
        <KpiCard icon={XCircle} label="Rupture" value={String(outCount)} tone="rose" />
        <KpiCard icon={Coins} label="Valeur du stock" value={formatFCFA(totalValue)} tone="emerald" />
      </div>

      <div className="glass rounded-2xl p-3 flex flex-wrap gap-3 items-center">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Tous ({items.length})</TabsTrigger>
            <TabsTrigger value="low">Faible ({lowCount})</TabsTrigger>
            <TabsTrigger value="out">Rupture ({outCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Produit ou SKU…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {["Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Valeur</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                <TableCell className="text-right font-semibold">{p.stock} {p.unit}</TableCell>
                <TableCell className="text-right text-muted-foreground">{p.minStock}</TableCell>
                <TableCell><StockStatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right text-sm">{formatFCFA(p.stock * p.pricePerKg)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="outline" className="gap-1 h-8"><Link to="/farmer/stock/movement/new" search={{ productId: p.id, type: "in" }}><Plus className="h-3.5 w-3.5" /></Link></Button>
                    <Button asChild size="sm" variant="outline" className="gap-1 h-8"><Link to="/farmer/stock/movement/new" search={{ productId: p.id, type: "out" }}><Minus className="h-3.5 w-3.5" /></Link></Button>
                    <Button asChild size="sm" variant="outline" className="h-8"><Link to="/farmer/stock/$productId/history" params={{ productId: p.id }}><History className="h-3.5 w-3.5" /></Link></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SidePanel open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-4">
            <img src={selected.image} alt="" className="w-full aspect-video object-cover rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Stock</div>
                <div className="font-bold text-lg">{selected.stock} {selected.unit}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Valeur</div>
                <div className="font-bold text-lg text-primary">{formatFCFA(selected.stock * selected.pricePerKg)}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Button asChild className="w-full gap-2"><Link to="/farmer/stock/movement/new" search={{ productId: selected.id, type: "in" }}><Plus className="h-4 w-4" />Ajouter (récolte)</Link></Button>
              <Button asChild variant="outline" className="w-full gap-2"><Link to="/farmer/stock/movement/new" search={{ productId: selected.id, type: "out" }}><Minus className="h-4 w-4" />Retirer (perte)</Link></Button>
              <Button asChild variant="outline" className="w-full gap-2"><Link to="/farmer/stock/$productId/history" params={{ productId: selected.id }}><History className="h-4 w-4" />Historique des mouvements</Link></Button>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
