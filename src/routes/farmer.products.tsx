import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Copy, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { products as seed, type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export const Route = createFileRoute("/farmer/products")({
  head: () => ({ meta: [{ title: "Mes produits · Diambar Agro" }] }),
  component: ProductsPage,
});

const CATEGORIES: Product["category"][] = ["Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"];

function ProductsPage() {
  const [items, setItems] = useState<Product[]>(seed.filter((p) => p.farmerId === "f1"));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => items.filter((p) =>
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())) &&
    (cat === "all" || p.category === cat) &&
    (status === "all" || p.status === status)
  ), [items, q, cat, status]);

  const openNew = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setEditOpen(true); };
  const duplicate = (p: Product) => {
    const copy: Product = { ...p, id: `p${Date.now()}`, name: p.name + " (copie)", sku: p.sku + "-C" };
    setItems((arr) => [copy, ...arr]);
    toast.success("Produit dupliqué");
  };
  const remove = () => {
    if (!toDelete) return;
    setItems((arr) => arr.filter((x) => x.id !== toDelete.id));
    toast.success(`${toDelete.name} supprimé`);
    setToDelete(null);
  };
  const save = (data: Product) => {
    setItems((arr) => editing ? arr.map((x) => x.id === editing.id ? data : x) : [{ ...data, id: `p${Date.now()}` }, ...arr]);
    setEditOpen(false);
    toast.success(editing ? "Produit modifié" : "Produit ajouté");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes produits"
        subtitle={`${items.length} référence(s) · ${items.filter((p) => p.status === "active").length} active(s)`}
        actions={<Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Ajouter un produit</Button>}
      />

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit ou SKU…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">En stock</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
            <SelectItem value="out">Rupture</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="Aucun produit trouvé" description="Ajustez vos filtres ou créez un nouveau produit." action={<Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Ajouter</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const pct = Math.min(100, Math.round((p.stock / Math.max(1, p.minStock * 2)) * 100));
            return (
              <div key={p.id} className="glass rounded-2xl overflow-hidden group flex flex-col">
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition" />
                  <div className="absolute top-2 left-2"><StockStatusBadge status={p.status} /></div>
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="grid h-8 w-8 place-items-center rounded-lg bg-background/80 backdrop-blur hover:bg-background"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4 mr-2" />Éditer</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate(p)}><Copy className="h-4 w-4 mr-2" />Dupliquer</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setToDelete(p)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.category} · {p.sku}</div>
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

      <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} product={editing} onSave={save} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.name} sera retiré de votre catalogue. Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductFormDialog({ open, onOpenChange, product, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; product: Product | null; onSave: (p: Product) => void }) {
  const empty: Product = { id: "", name: "", category: "Légumes", pricePerKg: 0, unit: "kg", stock: 0, minStock: 0, sku: "", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600", status: "draft", ordersThisMonth: 0, farmerId: "f1" };
  const [form, setForm] = useState<Product>(product || empty);
  // sync when opening with a different product
  useMemoSync(() => setForm(product || empty), [product, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.pricePerKg <= 0 || !form.sku) { toast.error("Renseignez nom, prix et SKU"); return; }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Éditer le produit" : "Nouveau produit"}</DialogTitle>
          <DialogDescription>Informations visibles par les restaurants.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Product["category"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Unité"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Prix / unité (FCFA)"><Input type="number" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: Number(e.target.value) })} /></Field>
            <Field label="Stock"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></Field>
            <Field label="Stock min"><Input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Image (URL)"><Input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
          <Field label="Statut">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Product["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">En stock</SelectItem>
                <SelectItem value="low">Stock faible</SelectItem>
                <SelectItem value="out">Rupture</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit">{product ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// helper that syncs state when deps change (avoids extra effect import noise)
import { useEffect as useMemoSync } from "react";
