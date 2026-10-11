import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PackageMinus,
  TriangleAlert,
  Truck,
  ClipboardCheck,
  ExternalLink,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  useReturns,
  returnStage,
  RETURN_STAGE_LABEL,
  RETURN_REASON_LABEL,
  farmerForReturn,
  type ReturnReason,
  type ReturnStage,
} from "@/data/business";
import { useRefunds, refundedTotalForOrder } from "@/data/finance";
import { useOrders, useProducts } from "@/data/store";
import { farmers, restaurants } from "@/data/mocks";

export const Route = createFileRoute("/admin/returns/")({
  head: () => ({
    meta: [
      { title: "Retours — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Centre de gestion des retours produits : demande, récupération, inspection, décision et remboursement.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReturns,
});

const STAGE_CLASS: Record<ReturnStage, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  refused: "bg-destructive/10 text-destructive border-destructive/20",
  awaiting_pickup: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  in_pickup: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  received: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  inspected: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  closed: "bg-muted text-muted-foreground border-border",
};

const REASON_COLOR: Record<ReturnReason, string> = {
  quality: "#8b5cf6",
  damaged: "#f59e0b",
  quantity: "#3b82f6",
  wrong_item: "#ec4899",
  late: "#ef4444",
  other: "#6b7280",
};

const PERIODS = [7, 30, 90] as const;

function hoursBetween(a?: string, b?: string) {
  if (!a || !b) return undefined;
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function fmtHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, "0")}`;
}

function AdminReturns() {
  const returns = useReturns();
  const refunds = useRefunds();
  const orders = useOrders();
  const products = useProducts();

  const [view, setView] = useState<"apercu" | "analyse">("apercu");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "pickup" | "inspect" | "accepted" | "refused"
  >("all");
  const [reasonFilter, setReasonFilter] = useState<"all" | ReturnReason>("all");
  const [search, setSearch] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [metric, setMetric] = useState<"count" | "amount">("count");

  const refNow = useMemo(() => {
    const ts = returns.map((r) => +new Date(r.createdAt));
    return ts.length ? Math.max(...ts) : Date.now();
  }, [returns]);

  const pending = returns.filter((r) => r.status === "pending");
  const awaitingPickup = returns.filter((r) => returnStage(r) === "awaiting_pickup");
  const inPickup = returns.filter((r) => returnStage(r) === "in_pickup");
  const toInspect = returns.filter((r) => returnStage(r) === "received");
  const accepted = returns.filter((r) => r.status === "accepted" || r.status === "credited");
  const refused = returns.filter((r) => r.status === "refused");
  const openReturns = returns.filter(
    (r) => !r.closedAt && r.status !== "refused" && r.status !== "credited",
  );
  const openAmount = openReturns.reduce((s, r) => s + r.requestedAmount, 0);

  const decided = returns.filter((r) => r.decidedAt);
  const avgDecisionHours = decided.length
    ? decided.reduce((s, r) => s + (hoursBetween(r.createdAt, r.decidedAt) ?? 0), 0) /
      decided.length
    : 0;

  const overduePending = pending.filter((r) => (refNow - +new Date(r.createdAt)) / 3_600_000 > 48);
  const overdueInspection = toInspect.filter(
    (r) => r.pickup?.receivedAt && (refNow - +new Date(r.pickup.receivedAt)) / 3_600_000 > 48,
  );

  const anomalies = useMemo(() => {
    const sevenDaysAgo = refNow - 7 * 86_400_000;
    const byRestaurant = new Map<string, number>();
    returns.forEach((r) => {
      if (+new Date(r.createdAt) >= sevenDaysAgo) {
        byRestaurant.set(r.restaurantId, (byRestaurant.get(r.restaurantId) ?? 0) + 1);
      }
    });
    const byProduct = new Map<string, number>();
    returns.forEach((r) => {
      if (r.productId) byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + 1);
    });

    const list: { key: string; text: string; returnId?: string }[] = [];
    byRestaurant.forEach((n, restaurantId) => {
      if (n >= 3) {
        const name = restaurants.find((r) => r.id === restaurantId)?.name ?? restaurantId;
        list.push({ key: `client-${restaurantId}`, text: `${name} : ${n} retours en 7 jours` });
      }
    });
    byProduct.forEach((n, productId) => {
      if (n >= 2) {
        const name = products.find((p) => p.id === productId)?.name ?? productId;
        list.push({ key: `product-${productId}`, text: `${name} : ${n} retours cumulés` });
      }
    });
    returns.forEach((r) => {
      const order = orders.find((o) => o.reference === r.orderRef);
      const line = order?.items.find((i) => i.productId === r.productId);
      if (line && r.qty > line.qty) {
        list.push({
          key: `qty-${r.id}`,
          text: `${r.reference} : quantité retournée (${r.qty}) supérieure à la commande (${line.qty})`,
          returnId: r.id,
        });
      }
      if (order && refundedTotalForOrder(refunds, r.orderRef) > order.total) {
        list.push({
          key: `double-${r.id}`,
          text: `${r.reference} : remboursements cumulés supérieurs au montant de la commande`,
          returnId: r.id,
        });
      }
    });
    overdueInspection.forEach((r) => {
      list.push({
        key: `insp-${r.id}`,
        text: `${r.reference} : réceptionné depuis plus de 48h, inspection en attente`,
        returnId: r.id,
      });
    });
    return list;
  }, [returns, orders, refunds, products, refNow, overdueInspection]);

  const chartData = useMemo(() => {
    const days: { date: string; count: number; amount: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(refNow - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const dayReturns = returns.filter((r) => r.createdAt.slice(0, 10) === key);
      days.push({
        date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        count: dayReturns.length,
        amount: dayReturns.reduce((s, r) => s + r.requestedAmount, 0),
      });
    }
    return days;
  }, [returns, period, refNow]);

  const reasonBreakdown = useMemo(() => {
    const map = new Map<ReturnReason, number>();
    returns.forEach((r) => map.set(r.reason, (map.get(r.reason) ?? 0) + 1));
    return [...map.entries()]
      .map(([reason, count]) => ({ reason, count, label: RETURN_REASON_LABEL[reason] }))
      .sort((a, b) => b.count - a.count);
  }, [returns]);

  const filtered = returns.filter((r) => {
    const stage = returnStage(r);
    if (statusFilter === "pending" && r.status !== "pending") return false;
    if (statusFilter === "pickup" && stage !== "awaiting_pickup" && stage !== "in_pickup")
      return false;
    if (statusFilter === "inspect" && stage !== "received" && stage !== "inspected") return false;
    if (statusFilter === "accepted" && r.status !== "accepted" && r.status !== "credited")
      return false;
    if (statusFilter === "refused" && r.status !== "refused") return false;
    if (reasonFilter !== "all" && r.reason !== reasonFilter) return false;
    if (urgentOnly && !overduePending.includes(r) && !overdueInspection.includes(r)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.reference.toLowerCase().includes(q) &&
        !r.restaurantName.toLowerCase().includes(q) &&
        !r.productName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // --- Analyse ---
  const totalOrders = orders.length;
  const returnRate = totalOrders ? (returns.length / totalOrders) * 100 : 0;

  const byCategory = useMemo(() => {
    const categories = new Set(products.map((p) => p.category));
    return [...categories]
      .map((cat) => {
        const orderCount = orders.reduce(
          (s, o) =>
            s +
            o.items.filter((i) => products.find((p) => p.id === i.productId)?.category === cat)
              .length,
          0,
        );
        const returnCount = returns.filter(
          (r) => products.find((p) => p.id === r.productId)?.category === cat,
        ).length;
        return {
          category: cat,
          orderCount,
          returnCount,
          rate: orderCount ? (returnCount / orderCount) * 100 : 0,
        };
      })
      .filter((c) => c.orderCount > 0 || c.returnCount > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [orders, returns, products]);

  const byZone = useMemo(() => {
    const map = new Map<string, { orders: number; returns: number }>();
    orders.forEach((o) => {
      const city = restaurants.find((r) => r.id === o.restaurantId)?.city ?? "?";
      const e = map.get(city) ?? { orders: 0, returns: 0 };
      e.orders += 1;
      map.set(city, e);
    });
    returns.forEach((r) => {
      const city = restaurants.find((x) => x.id === r.restaurantId)?.city ?? "?";
      const e = map.get(city) ?? { orders: 0, returns: 0 };
      e.returns += 1;
      map.set(city, e);
    });
    return [...map.entries()]
      .map(([city, v]) => ({ city, ...v, rate: v.orders ? (v.returns / v.orders) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [orders, returns]);

  const byFarmer = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; returns: number }>();
    orders.forEach((o) => {
      const f = farmers.find((x) => x.id === o.farmerId);
      const e = map.get(o.farmerId) ?? { name: f?.name ?? o.farmerId, orders: 0, returns: 0 };
      e.orders += 1;
      map.set(o.farmerId, e);
    });
    returns.forEach((r) => {
      const farmer = farmerForReturn(r);
      if (!farmer) return;
      const e = map.get(farmer.id) ?? { name: farmer.name, orders: 0, returns: 0 };
      e.returns += 1;
      map.set(farmer.id, e);
    });
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v, rate: v.orders ? (v.returns / v.orders) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [orders, returns]);

  const avgDemandeDecision = avgDecisionHours;
  const avgRecuperationReception = useMemo(() => {
    const vals = returns
      .map((r) => hoursBetween(r.pickup?.scheduledAt, r.pickup?.receivedAt))
      .filter((h): h is number => h !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  }, [returns]);
  const avgReceptionInspection = useMemo(() => {
    const vals = returns
      .map((r) => hoursBetween(r.pickup?.receivedAt, r.inspection?.inspectedAt))
      .filter((h): h is number => h !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  }, [returns]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retours"
        subtitle="Demande, récupération, inspection, décision et remboursement — un dossier complet par retour"
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as "apercu" | "analyse")}>
            <TabsList>
              <TabsTrigger value="apercu">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="analyse">Analyse</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {view === "apercu" ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Demandes ouvertes"
              value={String(openReturns.length)}
              icon={PackageMinus}
              hint={formatFCFA(openAmount)}
            />
            <StatCard
              label="À valider"
              value={String(pending.length)}
              icon={TriangleAlert}
              hint={pending.length > 0 ? "Action requise" : undefined}
            />
            <StatCard
              label="En récupération"
              value={String(awaitingPickup.length + inPickup.length)}
              icon={Truck}
            />
            <StatCard
              label="À inspecter"
              value={String(toInspect.length)}
              icon={ClipboardCheck}
              hint={toInspect.length > 0 ? "Action requise" : undefined}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Acceptés" value={String(accepted.length)} icon={PackageMinus} />
            <StatCard label="Refusés" value={String(refused.length)} icon={PackageMinus} />
            <StatCard label="Montant concerné" value={formatFCFA(openAmount)} icon={PackageMinus} />
            <StatCard
              label="Délai moyen"
              value={decided.length ? fmtHours(avgDecisionHours) : "—"}
              icon={PackageMinus}
              hint="Demande → décision"
            />
          </div>

          {(overduePending.length > 0 ||
            awaitingPickup.length > 0 ||
            toInspect.length > 0 ||
            anomalies.length > 0) && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">À traiter maintenant</h3>
              <div className="space-y-2 text-sm">
                {pending.length > 0 && (
                  <button
                    onClick={() => setStatusFilter("pending")}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="text-destructive">🔴</span>
                    {pending.length} demande(s) nécessitent une décision
                  </button>
                )}
                {awaitingPickup.length > 0 && (
                  <button
                    onClick={() => setStatusFilter("pickup")}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="text-amber-500">🟠</span>
                    {awaitingPickup.length} produit(s) attendent une récupération
                  </button>
                )}
                {toInspect.length > 0 && (
                  <button
                    onClick={() => setStatusFilter("inspect")}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    {toInspect.length} produit(s) attendent une inspection
                  </button>
                )}
                {overduePending.length > 0 && (
                  <button
                    onClick={() => setUrgentOnly(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <TriangleAlert className="h-4 w-4 text-amber-500" />
                    {overduePending.length} retour(s) dépassent 48h sans décision
                  </button>
                )}
                {anomalies.slice(0, 5).map((a) =>
                  a.returnId ? (
                    <Link
                      key={a.key}
                      to="/admin/returns/$returnId"
                      params={{ returnId: a.returnId }}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"
                    >
                      <span className="text-destructive">🔴</span>
                      {a.text}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  ) : (
                    <div key={a.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <span className="text-destructive">🔴</span>
                      {a.text}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold">Évolution des retours</h3>
                <div className="flex items-center gap-2">
                  <Tabs value={metric} onValueChange={(v) => setMetric(v as "count" | "amount")}>
                    <TabsList>
                      <TabsTrigger value="count">Nombre</TabsTrigger>
                      <TabsTrigger value="amount">Montant</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Tabs
                    value={String(period)}
                    onValueChange={(v) => setPeriod(Number(v) as 7 | 30 | 90)}
                  >
                    <TabsList>
                      {PERIODS.map((p) => (
                        <TabsTrigger key={p} value={String(p)}>
                          {p}j
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={metric === "amount" ? 60 : 30}
                  />
                  <Tooltip
                    formatter={(v: number) => (metric === "amount" ? formatFCFA(v) : String(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#retGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Motifs des retours</h3>
              {reasonBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun retour pour le moment.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={reasonBreakdown}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {reasonBreakdown.map((d) => (
                          <Cell key={d.reason} fill={REASON_COLOR[d.reason]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1 text-xs">
                    {reasonBreakdown.map((d) => (
                      <div key={d.reason} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: REASON_COLOR[d.reason] }}
                          />
                          {d.label}
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round((d.count / returns.length) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Référence, restaurant, produit…"
                className="pl-8"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">À valider</option>
              <option value="pickup">En récupération</option>
              <option value="inspect">À inspecter</option>
              <option value="accepted">Acceptés / avoir</option>
              <option value="refused">Refusés</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as typeof reasonFilter)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="all">Tous les motifs</option>
              {Object.entries(RETURN_REASON_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={urgentOnly}
                onChange={(e) => setUrgentOnly(e.target.checked)}
              />
              Urgents uniquement
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title="Aucun retour"
              description="Aucune demande de retour ne correspond à ces filtres."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => {
                const refund = refunds.find((f) => f.returnId === r.id);
                const stage = returnStage(r);
                return (
                  <Link
                    key={r.id}
                    to="/admin/returns/$returnId"
                    params={{ returnId: r.id }}
                    className="block glass rounded-2xl p-4 hover:border-primary/40 border border-transparent transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-52 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{r.reference}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STAGE_CLASS[stage]}`}
                          >
                            {RETURN_STAGE_LABEL[stage]}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {RETURN_REASON_LABEL[r.reason]}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {r.restaurantName} · {r.orderRef} · {r.productName} ({r.qty} {r.unit}) ·{" "}
                          {relativeTime(r.createdAt)}
                        </div>
                        <p className="mt-1 text-sm line-clamp-1">{r.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Montant demandé</div>
                        <div className="text-lg font-bold">{formatFCFA(r.requestedAmount)}</div>
                        {refund && (
                          <div className="mt-1 text-xs text-primary inline-flex items-center gap-1">
                            {refund.reference}
                            <ExternalLink className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Commandes" value={String(totalOrders)} icon={PackageMinus} />
            <StatCard label="Retours" value={String(returns.length)} icon={PackageMinus} />
            <StatCard
              label="Taux de retour"
              value={`${returnRate.toFixed(2)} %`}
              icon={TriangleAlert}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Taux de retour par catégorie</h3>
              {byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pas assez de données.</p>
              ) : (
                <div className="space-y-2">
                  {byCategory.map((c) => (
                    <div key={c.category} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0">{c.category}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-violet-500"
                          style={{ width: `${Math.min(100, c.rate * 8)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-muted-foreground">
                        {c.rate.toFixed(1)} %
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Délai moyen de traitement</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Demande → décision</span>
                  <span className="font-medium">
                    {decided.length ? fmtHours(avgDemandeDecision) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Récupération → réception</span>
                  <span className="font-medium">
                    {avgRecuperationReception !== undefined
                      ? fmtHours(avgRecuperationReception)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Réception → inspection</span>
                  <span className="font-medium">
                    {avgReceptionInspection !== undefined ? fmtHours(avgReceptionInspection) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Par zone</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal pb-2">Zone</th>
                    <th className="text-right font-normal pb-2">Commandes</th>
                    <th className="text-right font-normal pb-2">Retours</th>
                    <th className="text-right font-normal pb-2">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {byZone.map((z) => (
                    <tr key={z.city} className="border-t border-border">
                      <td className="py-1.5">{z.city}</td>
                      <td className="py-1.5 text-right">{z.orders}</td>
                      <td className="py-1.5 text-right">{z.returns}</td>
                      <td className="py-1.5 text-right">{z.rate.toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Par agriculteur</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal pb-2">Agriculteur</th>
                    <th className="text-right font-normal pb-2">Commandes</th>
                    <th className="text-right font-normal pb-2">Retours</th>
                    <th className="text-right font-normal pb-2">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {byFarmer.map((f) => (
                    <tr key={f.id} className="border-t border-border">
                      <td className="py-1.5">{f.name}</td>
                      <td className="py-1.5 text-right">{f.orders}</td>
                      <td className="py-1.5 text-right">{f.returns}</td>
                      <td className="py-1.5 text-right">{f.rate.toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
