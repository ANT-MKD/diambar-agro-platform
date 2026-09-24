import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, ShoppingBag, TrendingUp, Truck, Star } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrders } from "@/data/store";
import { usePlatformUsers, useCommissionTiers } from "@/data/admin-store";
import { farmers, restaurants, products, type Order } from "@/data/mocks";
import { commissionForOrder, deliveredVolumeByFarmer } from "@/lib/commission";
import { formatFCFA } from "@/lib/format";
import { ROLE_COLOR, ROLE_LABEL } from "@/lib/role-colors";
import { useRecordedCommissions } from "@/data/store";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Volume d'affaires, comparaison de périodes, ventilation commission et performance des producteurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalytics,
});

const PERIODS = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
  { key: "365", label: "12 mois", days: 365 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const METRICS = [
  { key: "gmv", label: "GMV" },
  { key: "orders", label: "Commandes" },
  { key: "commission", label: "Commissions" },
  { key: "basket", label: "Panier moyen" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

function windowOrders(orders: Order[], endTime: number, days: number) {
  const start = endTime - days * 86_400_000;
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t > start && t <= endTime;
  });
}

function pctDelta(curr: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return Math.round(((curr - prev) / prev) * 100);
}

function AdminAnalytics() {
  const orders = useOrders();
  const users = usePlatformUsers();
  const tiers = useCommissionTiers();
  const recorded = useRecordedCommissions();
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [metric, setMetric] = useState<MetricKey>("gmv");

  const periodDays = PERIODS.find((p) => p.key === periodKey)!.days;
  const volumeByFarmer = useMemo(() => deliveredVolumeByFarmer(orders), [orders]);

  // Les commandes de démo sont figées à une date passée : on ancre "maintenant"
  // sur la commande la plus récente réellement enregistrée plutôt que sur
  // l'horloge système, sinon toutes les fenêtres de période seraient vides.
  const refNow = useMemo(() => {
    if (orders.length === 0) return Date.now();
    return orders.reduce((a, o) => Math.max(a, new Date(o.createdAt).getTime()), 0);
  }, [orders]);

  const current = useMemo(
    () => windowOrders(orders, refNow, periodDays),
    [orders, refNow, periodDays],
  );
  const previous = useMemo(
    () => windowOrders(orders, refNow - periodDays * 86_400_000, periodDays),
    [orders, refNow, periodDays],
  );

  const stats = (list: Order[]) => {
    const delivered = list.filter((o) => o.status === "delivered");
    const gmv = delivered.reduce((s, o) => s + o.total, 0);
    const avgBasket = delivered.length > 0 ? Math.round(gmv / delivered.length) : 0;
    const deliveryRate = list.length > 0 ? Math.round((delivered.length / list.length) * 100) : 0;
    return { orders: list.length, delivered: delivered.length, gmv, avgBasket, deliveryRate };
  };
  const curr = stats(current);
  const prev = stats(previous);
  // On ne compare que si la période précédente a réellement des données —
  // sinon un pourcentage de variation serait inventé (division par une
  // activité qui n'existe pas encore dans la démo).
  const hasComparison = previous.length > 0;

  const dailySeries = useMemo(() => {
    const totals = new Map<string, { gmv: number; orders: number; commission: number }>();
    for (const o of current) {
      const day = o.createdAt.slice(0, 10);
      const cur = totals.get(day) ?? { gmv: 0, orders: 0, commission: 0 };
      cur.orders += 1;
      if (o.status === "delivered") {
        cur.gmv += o.total;
        cur.commission += commissionForOrder(o, tiers, volumeByFarmer, recorded);
      }
      totals.set(day, cur);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        gmv: v.gmv,
        orders: v.orders,
        commission: Math.round(v.commission),
        basket: v.orders > 0 ? Math.round(v.gmv / v.orders) : 0,
      }));
  }, [current, tiers, volumeByFarmer, recorded]);

  const roleSplit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    return Array.from(counts.entries()).map(([role, value]) => ({ role, value }));
  }, [users]);

  const byCity = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of current) {
      if (o.status !== "delivered") continue;
      const r = restaurants.find((x) => x.id === o.restaurantId);
      const city = r?.city ?? "Autre";
      totals.set(city, (totals.get(city) ?? 0) + o.total);
    }
    const arr = Array.from(totals.entries())
      .map(([city, total]) => ({ city, total }))
      .sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...arr.map((c) => c.total));
    return arr.map((c) => ({ ...c, pct: Math.round((c.total / max) * 100) }));
  }, [current]);

  // Répartition réelle du GMV livré : commission plateforme vs part reversée
  // aux producteurs — calculée avec le même barème dégressif que Finance et
  // Commandes, pas un pourcentage arbitraire.
  const revenueSplit = useMemo(() => {
    const delivered = current.filter((o) => o.status === "delivered");
    const gmv = delivered.reduce((s, o) => s + o.total, 0);
    const commission = delivered.reduce(
      (s, o) => s + commissionForOrder(o, tiers, volumeByFarmer, recorded),
      0,
    );
    return { gmv, commission: Math.round(commission), farmerRevenue: gmv - Math.round(commission) };
  }, [current, tiers, volumeByFarmer, recorded]);

  const orderFunnel = [
    { key: "pending", label: "En attente", tone: "#f59e0b" },
    { key: "confirmed", label: "Confirmées", tone: "#3b82f6" },
    { key: "preparing", label: "Préparation", tone: "#8b5cf6" },
    { key: "delivering", label: "En livraison", tone: "#0ea5e9" },
    { key: "delivered", label: "Livrées", tone: "#10b981" },
    { key: "cancelled", label: "Annulées", tone: "#ef4444" },
  ].map((s) => ({ ...s, count: current.filter((o) => o.status === s.key).length }));

  const farmerPerf = useMemo(() => {
    return farmers
      .map((f) => {
        const all = current.filter((o) => o.farmerId === f.id);
        const delivered = all.filter((o) => o.status === "delivered");
        const cancelled = all.filter((o) => o.status === "cancelled");
        const gmv = delivered.reduce((s, o) => s + o.total, 0);
        const qtyByProduct = new Map<string, number>();
        for (const o of all) {
          for (const it of o.items) {
            qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.qty);
          }
        }
        const topProductId = [...qtyByProduct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const topProduct = products.find((p) => p.id === topProductId)?.name;
        const account = users.find((u) => u.name === f.name);
        return {
          farmer: f,
          orders: all.length,
          gmv,
          avgBasket: delivered.length > 0 ? Math.round(gmv / delivered.length) : 0,
          cancelRate: all.length > 0 ? Math.round((cancelled.length / all.length) * 100) : 0,
          topProduct,
          account,
        };
      })
      .filter((r) => r.orders > 0)
      .sort((a, b) => b.gmv - a.gmv);
  }, [current, users]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Performance de la plateforme — calculée en direct sur les commandes réelles"
        actions={
          <Tabs value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.key} value={p.key}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="GMV (commandes livrées)"
          value={formatFCFA(curr.gmv)}
          delta={hasComparison ? pctDelta(curr.gmv, prev.gmv) : undefined}
          icon={Wallet}
          hint={hasComparison ? undefined : "Pas assez de recul pour comparer"}
        />
        <StatCard
          label="Commandes"
          value={String(curr.orders)}
          delta={hasComparison ? pctDelta(curr.orders, prev.orders) : undefined}
          icon={ShoppingBag}
          hint={hasComparison ? undefined : "Pas assez de recul pour comparer"}
        />
        <StatCard
          label="Panier moyen"
          value={formatFCFA(curr.avgBasket)}
          delta={hasComparison ? pctDelta(curr.avgBasket, prev.avgBasket) : undefined}
          icon={TrendingUp}
          hint="Sur commandes livrées"
        />
        <StatCard
          label="Taux de livraison"
          value={`${curr.deliveryRate}%`}
          delta={hasComparison ? pctDelta(curr.deliveryRate, prev.deliveryRate) : undefined}
          icon={Truck}
          hint="Livrées / total"
        />
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold">Volume d'affaires</h2>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <TabsList>
              {METRICS.map((m) => (
                <TabsTrigger key={m.key} value={m.key}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="h-64 mt-4">
          {dailySeries.length === 0 ? (
            <p className="h-full grid place-items-center text-sm text-muted-foreground">
              Aucune commande sur cette période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => (metric === "orders" ? v : formatFCFA(v))}
                />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#gmvFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Répartition des comptes</h2>
          <p className="text-xs text-muted-foreground">Par rôle, tous statuts confondus</p>
          <div className="h-40 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleSplit}
                  dataKey="value"
                  nameKey="role"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {roleSplit.map((s) => (
                    <Cell key={s.role} fill={ROLE_COLOR[s.role] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 mt-2">
            {roleSplit.map((s) => (
              <li key={s.role} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: ROLE_COLOR[s.role] ?? "#94a3b8" }}
                />
                <span className="flex-1">{ROLE_LABEL[s.role] ?? s.role}</span>
                <span className="font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Répartition du GMV livré</h2>
          <p className="text-xs text-muted-foreground">Commission vs revenu producteurs</p>
          {revenueSplit.gmv === 0 ? (
            <p className="text-sm text-muted-foreground mt-6 text-center">
              Aucune commande livrée sur cette période.
            </p>
          ) : (
            <>
              <div className="h-40 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Revenu producteurs", value: revenueSplit.farmerRevenue },
                        { name: "Commission plateforme", value: revenueSplit.commission },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatFCFA(v)}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 mt-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="flex-1">Revenu producteurs</span>
                  <span className="font-semibold">{formatFCFA(revenueSplit.farmerRevenue)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <span className="flex-1">Commission plateforme</span>
                  <span className="font-semibold">{formatFCFA(revenueSplit.commission)}</span>
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Performance des commandes</h2>
          <p className="text-xs text-muted-foreground">Sur la période sélectionnée</p>
          <div className="h-40 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderFunnel.filter((s) => s.count > 0)}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {orderFunnel
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <Cell key={s.key} fill={s.tone} />
                    ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 mt-2 text-sm">
            {orderFunnel.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.tone }} />
                <span className="flex-1">{s.label}</span>
                <span className="font-semibold">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Activité par zone</h2>
        <p className="text-xs text-muted-foreground">GMV livré par ville du restaurant</p>
        <div className="grid lg:grid-cols-2 gap-6 mt-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="city"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatFCFA(v)}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2.5 self-center">
            {byCity.length === 0 && (
              <li className="text-sm text-muted-foreground">Aucune donnée sur cette période.</li>
            )}
            {byCity.map((c) => (
              <li key={c.city}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{c.city}</span>
                  <span className="text-muted-foreground">{formatFCFA(c.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Performance des producteurs</h2>
          <p className="text-xs text-muted-foreground">Sur la période sélectionnée</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Producteur</th>
                <th className="text-right font-medium px-4 py-3">Commandes</th>
                <th className="text-right font-medium px-4 py-3">GMV</th>
                <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                  Panier moyen
                </th>
                <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                  Annulation
                </th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                  Produit vedette
                </th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Zone</th>
                <th className="text-left font-medium px-4 py-3">Note</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Compte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {farmerPerf.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune commande sur cette période.
                  </td>
                </tr>
              )}
              {farmerPerf.map((r) => (
                <tr key={r.farmer.id} className="hover:bg-accent/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={r.farmer.avatar}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <span className="font-medium truncate">{r.farmer.farm}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{r.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatFCFA(r.gmv)}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
                    {formatFCFA(r.avgBasket)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span
                      className={
                        r.cancelRate > 15 ? "text-destructive font-medium" : "text-muted-foreground"
                      }
                    >
                      {r.cancelRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground truncate">
                    {r.topProduct ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {r.farmer.city}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {r.farmer.rating}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {r.account ? <AdminBadge value={r.account.status} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
