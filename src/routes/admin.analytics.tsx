import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet, ShoppingBag, TrendingUp, Truck } from "lucide-react";
import {
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
import { useOrders } from "@/data/store";
import { usePlatformUsers } from "@/data/admin-store";
import { farmers, restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { ROLE_COLOR, ROLE_LABEL } from "@/lib/role-colors";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Administration Diambar Agro" },
      {
        name: "description",
        content: "Volume d'affaires, répartition des comptes et top producteurs de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const orders = useOrders();
  const users = usePlatformUsers();

  const delivered = orders.filter((o) => o.status === "delivered");
  const gmv = delivered.reduce((s, o) => s + o.total, 0);
  const avgBasket = delivered.length > 0 ? Math.round(gmv / delivered.length) : 0;
  const deliveryRate = orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0;

  const roleSplit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    return Array.from(counts.entries()).map(([role, value]) => ({ role, value }));
  }, [users]);

  const byCity = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of orders) {
      const r = restaurants.find((x) => x.id === o.restaurantId);
      const city = r?.city ?? "Autre";
      totals.set(city, (totals.get(city) ?? 0) + o.total);
    }
    return Array.from(totals.entries())
      .map(([city, total]) => ({ city, total }))
      .sort((a, b) => b.total - a.total);
  }, [orders]);

  const topFarmers = useMemo(() => {
    const totals = new Map<string, { count: number; gmv: number }>();
    for (const o of delivered) {
      const cur = totals.get(o.farmerId) ?? { count: 0, gmv: 0 };
      totals.set(o.farmerId, { count: cur.count + 1, gmv: cur.gmv + o.total });
    }
    return Array.from(totals.entries())
      .map(([farmerId, v]) => ({ farmer: farmers.find((f) => f.id === farmerId), ...v }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);
  }, [delivered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Volume d'affaires et répartition de la plateforme — calculés en direct"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="GMV (commandes livrées)"
          value={formatFCFA(gmv)}
          icon={Wallet}
          hint={`${delivered.length} commande(s) livrée(s)`}
        />
        <StatCard label="Commandes totales" value={String(orders.length)} icon={ShoppingBag} />
        <StatCard
          label="Panier moyen"
          value={formatFCFA(avgBasket)}
          icon={TrendingUp}
          hint="Sur commandes livrées"
        />
        <StatCard
          label="Taux de livraison"
          value={`${deliveryRate}%`}
          icon={Truck}
          hint="Livrées / total"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-semibold">Volume d'affaires par ville</h2>
          <p className="text-xs text-muted-foreground">
            Total des commandes (tous statuts) par ville du restaurant
          </p>
          <div className="h-64 mt-4">
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
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Répartition des comptes</h2>
          <p className="text-xs text-muted-foreground">Par rôle</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleSplit}
                  dataKey="value"
                  nameKey="role"
                  innerRadius={45}
                  outerRadius={70}
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
          <ul className="space-y-2 mt-2">
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
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Top producteurs (par GMV livré)</h2>
        <ul className="mt-4 divide-y divide-border">
          {topFarmers.length === 0 && (
            <li className="text-sm text-muted-foreground py-2">Aucune commande livrée.</li>
          )}
          {topFarmers.map(({ farmer, count, gmv: farmerGmv }) => (
            <li key={farmer?.id} className="flex items-center gap-3 py-2.5">
              <img src={farmer?.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{farmer?.farm}</div>
                <div className="text-[11px] text-muted-foreground">{count} commande(s)</div>
              </div>
              <span className="font-semibold text-primary">{formatFCFA(farmerGmv)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
