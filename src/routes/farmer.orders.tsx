import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, LayoutGrid, List, Clock, Package2, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge } from "@/components/farmer/status-badge";
import { EmptyState } from "@/components/farmer/empty-state";
import { OrderKanban } from "@/components/farmer/order-kanban";
import { useOrders } from "@/data/store";
import { restaurants, products, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/farmer/orders")({
  head: () => ({ meta: [{ title: "Commandes · Diambar Agro" }] }),
  component: OrdersPage,
});

const TABS: { v: "all" | OrderStatus; label: string }[] = [
  { v: "all", label: "Toutes" },
  { v: "pending", label: "En attente" },
  { v: "confirmed", label: "Confirmées" },
  { v: "preparing", label: "Préparation" },
  { v: "delivering", label: "Livraison" },
  { v: "delivered", label: "Livrées" },
  { v: "cancelled", label: "Annulées" },
];

function OrdersPage() {
  const allOrders = useOrders();
  const items = useMemo(() => allOrders.filter((o) => o.farmerId === "f1"), [allOrders]);
  const [tab, setTab] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  const filtered = useMemo(() => items.filter((o) => {
    const r = restaurants.find((x) => x.id === o.restaurantId);
    return (tab === "all" || o.status === tab) &&
      (q === "" || o.reference.toLowerCase().includes(q.toLowerCase()) || r?.name.toLowerCase().includes(q.toLowerCase()));
  }), [items, tab, q]);

  const count = (s: "all" | OrderStatus) => s === "all" ? items.length : items.filter((o) => o.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        subtitle={`${items.length} commande(s) · glissez les cartes entre colonnes pour changer le statut`}
        actions={
          <div className="inline-flex rounded-xl border border-border p-1 bg-muted/40">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${view === "kanban" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" />Kanban</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${view === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}><List className="h-3.5 w-3.5" />Liste</button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-3 flex flex-wrap gap-3 items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="overflow-x-auto">
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => <TabsTrigger key={t.v} value={t.v}>{t.label} ({count(t.v)})</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[200px] ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence ou restaurant…" className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Aucune commande" description="Aucune commande ne correspond à ce filtre." />
      ) : view === "kanban" ? (
        <OrderKanban orders={filtered} />
      ) : (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-border">
          {filtered.map((o) => {
            const r = restaurants.find((x) => x.id === o.restaurantId);
            return (
              <Link key={o.id} to="/farmer/orders/$orderId" params={{ orderId: o.id }} className="flex items-center gap-4 p-4 hover:bg-accent transition">
                <img src={r?.avatar} alt="" className="h-11 w-11 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r?.name}</span>
                    <span className="text-xs text-muted-foreground">· {o.reference}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {o.items.map((it, i) => {
                      const p = products.find((x) => x.id === it.productId);
                      return <span key={i}>{i > 0 ? " · " : ""}{p?.name} ×{it.qty}</span>;
                    })}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{relativeTime(o.createdAt)}</div>
                <OrderStatusBadge status={o.status} />
                <span className="font-bold text-primary text-sm hidden md:block">{formatFCFA(o.total)}</span>
                <Package2 className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
