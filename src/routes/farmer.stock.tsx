import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Warehouse, AlertTriangle, XCircle, Coins, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { products as seed, type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/farmer/stock")({
  head: () => ({ meta: [{ title: "Stock · Diambar Agro" }] }),
  component: StockPage,
});

function StockPage() {
  const [items, setItems] = useState<Product[]>(seed.filter((p) => p.farmerId === "f1"));
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [adjust, setAdjust] = useState<Product | null>(null);

  const filtered = useMemo(() =>
    items.filter((p) => filter === "all" || (filter === "low" && p.status === "low") || (filter === "out" && p.status === "out"))
  , [items, filter]);

  const totalValue = items.reduce((acc, p) => acc + p.stock * p.pricePerKg, 0);
  const lowCount = items.filter((p) => p.status === "low").length;
  const outCount = items.filter((p) => p.status === "out").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion du stock" subtitle="Suivi et ajustement de vos références" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Warehouse} label="Références totales" value={String(items.length)} tone="blue" />
        <KpiCard icon={AlertTriangle} label="Stock faible" value={String(lowCount)} tone="amber" />
        <KpiCard icon={XCircle} label="Rupture" value={String(outCount)} tone="rose" />
        <KpiCard icon={Coins} label="Valeur du stock" value={formatFCFA(totalValue)} tone="emerald" />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">Tous ({items.length})</TabsTrigger>
            <TabsTrigger value="low">Stock faible ({lowCount})</TabsTrigger>
            <TabsTrigger value="out">Rupture ({outCount})</TabsTrigger>
          </TabsList>
        </Tabs>
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
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
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
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setAdjust(p)} className="gap-1"><Settings2 className="h-3.5 w-3.5" />Ajuster</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AdjustDialog product={adjust} onClose={() => setAdjust(null)} onApply={(p, qty) => {
        setItems((arr) => arr.map((x) => x.id === p.id ? { ...x, stock: Math.max(0, qty), status: qty === 0 ? "out" : qty < x.minStock ? "low" : "active" } : x));
        setAdjust(null);
        toast.success(`Stock ${p.name} mis à jour`);
      }} />
    </div>
  );
}

function AdjustDialog({ product, onClose, onApply }: { product: Product | null; onClose: () => void; onApply: (p: Product, qty: number) => void }) {
  const [type, setType] = useState<"add" | "remove" | "set">("add");
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState("");

  useEffect(() => { setType("add"); setQty(0); setReason(""); }, [product]);

  if (!product) return null;
  const next = type === "add" ? product.stock + qty : type === "remove" ? Math.max(0, product.stock - qty) : qty;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajuster le stock — {product.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Stock actuel : <span className="font-semibold text-foreground">{product.stock} {product.unit}</span></div>
          <div className="space-y-1.5">
            <Label>Type d'ajustement</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Ajout (récolte / approvisionnement)</SelectItem>
                <SelectItem value="remove">Retrait (perte / casse)</SelectItem>
                <SelectItem value="set">Inventaire (saisie absolue)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantité ({product.unit})</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Motif (optionnel)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Récolte du matin, casse en transport…" rows={2} />
          </div>
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-sm">Nouveau stock : <span className="font-bold text-primary">{next} {product.unit}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onApply(product, next)}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
