import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Check, X, Truck, Clock, Package2, Phone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { EmptyState } from "@/components/farmer/empty-state";
import { orders as seed, restaurants, drivers, products, type Order, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/farmer/orders")({
  head: () => ({ meta: [{ title: "Commandes · Diambar Agro" }] }),
  component: OrdersPage,
});

const TABS: { v: "all" | OrderStatus; label: string }[] = [
  { v: "all", label: "Toutes" },
  { v: "pending", label: "En attente" },
  { v: "confirmed", label: "Confirmées" },
  { v: "preparing", label: "En préparation" },
  { v: "delivering", label: "En livraison" },
  { v: "delivered", label: "Livrées" },
  { v: "cancelled", label: "Annulées" },
];

function OrdersPage() {
  const [items, setItems] = useState<Order[]>(seed.filter((o) => o.farmerId === "f1"));
  const [tab, setTab] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const filtered = useMemo(() => items.filter((o) => {
    const r = restaurants.find((x) => x.id === o.restaurantId);
    return (tab === "all" || o.status === tab) &&
      (q === "" || o.reference.toLowerCase().includes(q.toLowerCase()) || r?.name.toLowerCase().includes(q.toLowerCase()));
  }), [items, tab, q]);

  const count = (s: "all" | OrderStatus) => s === "all" ? items.length : items.filter((o) => o.status === s).length;

  const setStatus = (id: string, status: OrderStatus) => {
    setItems((arr) => arr.map((o) => o.id === id ? { ...o, status } : o));
    toast.success(`Commande ${ORDER_LABEL[status].toLowerCase()}`);
    if (selected?.id === id) setSelected({ ...selected, status });
  };
  const cancel = () => {
    if (!cancelTarget) return;
    setStatus(cancelTarget.id, "cancelled");
    setCancelTarget(null);
    setCancelReason("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Commandes" subtitle={`${items.length} commande(s) au total`} />

      <div className="glass rounded-2xl p-3 flex flex-wrap gap-3 items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="overflow-x-auto">
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label} ({count(t.v)})</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[200px] ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence ou restaurant…" className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package2} title="Aucune commande" description="Aucune commande ne correspond à ce filtre." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map((o) => {
            const r = restaurants.find((x) => x.id === o.restaurantId);
            return (
              <div key={o.id} className="glass rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={r?.avatar} alt={r?.name} className="h-11 w-11 rounded-xl object-cover" />
                    <div>
                      <div className="font-semibold">{r?.name}</div>
                      <div className="text-xs text-muted-foreground">{r?.city} · {o.reference}</div>
                    </div>
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {o.items.map((it, i) => {
                    const p = products.find((x) => x.id === it.productId);
                    return <span key={i}>{i > 0 ? " · " : ""}{p?.name} ×{it.qty}{p?.unit}</span>;
                  })}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{relativeTime(o.createdAt)}{o.eta && <> · ETA {o.eta}</>}</span>
                  <span className="font-display text-lg font-bold text-primary">{formatFCFA(o.total)}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setSelected(o)}>Détail</Button>
                  {o.status === "pending" && <Button size="sm" className="flex-1 gap-1" onClick={() => setStatus(o.id, "confirmed")}><Check className="h-3.5 w-3.5" />Confirmer</Button>}
                  {o.status === "confirmed" && <Button size="sm" className="flex-1 gap-1" onClick={() => setStatus(o.id, "preparing")}><Package2 className="h-3.5 w-3.5" />Préparer</Button>}
                  {o.status === "preparing" && <Button size="sm" className="flex-1 gap-1" onClick={() => setStatus(o.id, "delivering")}><Truck className="h-3.5 w-3.5" />Marquer prête</Button>}
                  {o.status === "delivering" && <Button size="sm" className="flex-1 gap-1" onClick={() => setStatus(o.id, "delivered")}><Check className="h-3.5 w-3.5" />Livrée</Button>}
                  {["pending", "confirmed", "preparing"].includes(o.status) && (
                    <Button size="sm" variant="outline" className="px-2.5" onClick={() => setCancelTarget(o)}><X className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (() => {
            const r = restaurants.find((x) => x.id === selected.restaurantId);
            const d = selected.driverId ? drivers.find((x) => x.id === selected.driverId) : null;
            const steps: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "delivered"];
            const currentIdx = steps.indexOf(selected.status);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.reference}</DialogTitle>
                  <div className="text-xs text-muted-foreground">Créée {relativeTime(selected.createdAt)}</div>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                    <img src={r?.avatar} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="flex-1">
                      <div className="font-medium">{r?.name}</div>
                      <div className="text-xs text-muted-foreground">{r?.city} · {r?.type}</div>
                    </div>
                    <Button size="icon" variant="outline"><Phone className="h-4 w-4" /></Button>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">PROGRESSION</div>
                    <div className="flex items-center gap-1">
                      {steps.map((s, i) => (
                        <div key={s} className="flex-1">
                          <div className={`h-1.5 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-muted"}`} />
                          <div className="text-[10px] mt-1 text-center text-muted-foreground">{ORDER_LABEL[s]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">ARTICLES</div>
                    <div className="space-y-2">
                      {selected.items.map((it, i) => {
                        const p = products.find((x) => x.id === it.productId);
                        return (
                          <div key={i} className="flex items-center justify-between text-sm rounded-lg border border-border p-2.5">
                            <span>{p?.name} <span className="text-muted-foreground">×{it.qty}{p?.unit}</span></span>
                            <span className="font-medium">{formatFCFA(it.qty * it.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between font-semibold">
                      <span>Total</span><span className="text-primary">{formatFCFA(selected.total)}</span>
                    </div>
                  </div>
                  {d && (
                    <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-3">
                      <img src={d.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.vehicle} · ★ {d.rating}</div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande ?</AlertDialogTitle>
            <AlertDialogDescription>{cancelTarget?.reference} · {formatFCFA(cancelTarget?.total || 0)}. Cette action est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motif (rupture, indisponibilité…)" rows={2} />
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={cancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Annuler la commande</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
