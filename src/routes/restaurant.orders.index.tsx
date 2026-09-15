import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LayoutGrid,
  List as ListIcon,
  Clock,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { useRestaurantOrders, restaurantOrderActions } from "@/data/store";
import { farmers, products, type OrderStatus, type RestaurantOrder } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/restaurant/orders/")({
  head: () => ({ meta: [{ title: "Mes Commandes · Restaurant" }] }),
  component: OrdersPage,
});

const COLS: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "delivered"];
const TABS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "preparing", label: "En préparation" },
  { key: "delivering", label: "En livraison" },
  { key: "delivered", label: "Livrées" },
  { key: "cancelled", label: "Annulées" },
];
const PERIODS = ["Toutes les dates", "7 derniers jours", "30 derniers jours", "90 derniers jours"];
const PAGE_SIZE = 7;

function withinPeriod(createdAt: string, period: string) {
  if (period === "Toutes les dates") return true;
  const days = period === "7 derniers jours" ? 7 : period === "30 derniers jours" ? 30 : 90;
  return Date.now() - new Date(createdAt).getTime() <= days * 86400_000;
}

function OrdersPage() {
  const orders = useRestaurantOrders();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [cols, setCols] = useState<Record<OrderStatus, RestaurantOrder[]>>(
    {} as Record<OrderStatus, RestaurantOrder[]>,
  );
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [farmerFilter, setFarmerFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const next: Record<string, RestaurantOrder[]> = {};
    COLS.forEach((c) => {
      next[c] = orders.filter((o) => o.status === c);
    });
    setCols(next as Record<OrderStatus, RestaurantOrder[]>);
  }, [orders]);

  const orderFarmers = useMemo(() => {
    const ids = new Set(orders.map((o) => o.farmerId));
    return farmers.filter((f) => ids.has(f.id));
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => (tab === "all" ? true : o.status === tab))
      .filter((o) => (farmerFilter === "all" ? true : o.farmerId === farmerFilter))
      .filter((o) => withinPeriod(o.createdAt, period))
      .filter((o) => {
        if (!q.trim()) return true;
        const f = farmers.find((x) => x.id === o.farmerId);
        const haystack = `${o.reference} ${f?.farm ?? ""}`.toLowerCase();
        return haystack.includes(q.trim().toLowerCase());
      });
  }, [orders, tab, farmerFilter, period, q]);

  useEffect(() => setPage(1), [tab, farmerFilter, period, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes Commandes"
        subtitle="Retrouvez toutes vos commandes auprès des agriculteurs et suivez leur progression."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-border p-1">
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <ListIcon className="h-3.5 w-3.5" />
                Liste
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${view === "kanban" ? "bg-primary text-primary-foreground" : ""}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
            </div>
            <Button asChild className="gap-2">
              <Link to="/restaurant/marketplace">
                <Plus className="h-4 w-4" />
                Nouvelle commande
              </Link>
            </Button>
          </div>
        }
      />

      {view === "list" ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => {
              const count =
                t.key === "all" ? orders.length : orders.filter((o) => o.status === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une commande…"
                className="pl-9"
              />
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={farmerFilter}
              onChange={(e) => setFarmerFilter(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="all">Tous les producteurs</option>
              {orderFarmers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farm}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {pageItems.length === 0 && (
              <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
                Aucune commande ne correspond à ces filtres.
              </div>
            )}
            {pageItems.map((o) => {
              const f = farmers.find((x) => x.id === o.farmerId);
              const preview = o.items
                .slice(0, 2)
                .map((it) => products.find((p) => p.id === it.productId)?.name)
                .filter(Boolean)
                .join(", ");
              const inProgress = ["confirmed", "preparing", "delivering"].includes(o.status);
              return (
                <div key={o.id} className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-[160px]">
                    <Link
                      to="/restaurant/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="font-semibold text-sm hover:text-primary"
                    >
                      {o.reference}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-w-[160px]">
                    <img src={f?.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                    <div>
                      <div className="text-xs font-medium">{f?.farm}</div>
                      <div className="text-[10px] text-muted-foreground">{f?.city}</div>
                    </div>
                  </div>
                  <div className="min-w-[140px] text-xs text-muted-foreground">
                    <div>
                      {o.items.length} produit{o.items.length > 1 ? "s" : ""}
                    </div>
                    <div className="truncate max-w-[160px]">{preview}</div>
                  </div>
                  <div className="min-w-[90px]">
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="font-semibold text-primary min-w-[100px]">
                    {formatFCFA(o.total)}
                  </div>
                  <div className="flex-1 min-w-[140px] text-xs text-muted-foreground flex items-center gap-1.5">
                    {inProgress && o.eta ? (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        <div>
                          <div>Arrivée estimée</div>
                          <div className="font-medium text-foreground">{o.eta}</div>
                        </div>
                      </>
                    ) : o.status === "delivered" ? (
                      <span>Livrée</span>
                    ) : o.status === "cancelled" ? (
                      <span>Commande annulée</span>
                    ) : (
                      <span>En attente de confirmation</span>
                    )}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/restaurant/orders/$orderId" params={{ orderId: o.id }}>
                      Voir le détail →
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Affichage de {(page - 1) * PAGE_SIZE + 1} à{" "}
                {Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} commandes
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 w-8 rounded-lg border border-border grid place-items-center disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold ${p === page ? "bg-primary text-primary-foreground" : "border border-border"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="h-8 w-8 rounded-lg border border-border grid place-items-center disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLS.map((col) => {
            const cards = cols[col] ?? [];
            return (
              <div key={col} className="glass rounded-2xl p-3 space-y-2 min-h-[300px]">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider">{ORDER_LABEL[col]}</h3>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-bold">
                    {cards.length}
                  </span>
                </div>
                {cards.map((o) => {
                  const f = farmers.find((x) => x.id === o.farmerId);
                  return (
                    <motion.div
                      key={o.id}
                      layout
                      drag
                      dragSnapToOrigin
                      whileDrag={{ scale: 1.04, zIndex: 50 }}
                      onDragEnd={(_, info) => {
                        if (Math.abs(info.offset.x) < 80) return;
                        const idx = COLS.indexOf(col);
                        const dir = info.offset.x > 0 ? 1 : -1;
                        const next = COLS[idx + dir];
                        if (next) {
                          restaurantOrderActions.setStatus(o.id, next);
                          toast.success(`Statut → ${ORDER_LABEL[next]}`);
                        }
                      }}
                      className="block bg-card rounded-xl p-3 border border-border cursor-grab active:cursor-grabbing"
                    >
                      <Link
                        to="/restaurant/orders/$orderId"
                        params={{ orderId: o.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="block"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={f?.avatar}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                          <span className="text-xs font-semibold">{f?.farm}</span>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {o.reference} · {o.items.length} art.
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {relativeTime(o.createdAt)}
                          </span>
                          <span className="font-bold text-sm text-primary">
                            {formatFCFA(o.total)}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
                {cards.length === 0 && (
                  <div className="text-center text-[11px] text-muted-foreground/60 py-8">Vide</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
