import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Award, Heart, Repeat, XOctagon, TriangleAlert, MapPin } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";
import { products, restaurants, missions } from "@/data/mocks";
import { useOrders } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/farmer/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Diambar Agro" }] }),
  component: AnalyticsPage,
});

const COLORS = [
  "oklch(0.7 0.17 155)",
  "oklch(0.75 0.18 50)",
  "oklch(0.65 0.2 260)",
  "oklch(0.8 0.18 80)",
  "oklch(0.7 0.2 20)",
  "oklch(0.7 0.15 320)",
];

function AnalyticsPage() {
  const orders = useOrders().filter((o) => o.farmerId === "f1");

  // Ventes par produit calculées depuis les vraies lignes de commande
  // (remplace l'ancien champ statique product.ordersThisMonth, jamais mis à jour).
  const productSales = new Map<string, { name: string; category: string; cmd: number }>();
  for (const o of orders) {
    for (const item of o.items) {
      const p = products.find((pp) => pp.id === item.productId);
      if (!p) continue;
      const entry = productSales.get(p.id) ?? { name: p.name, category: p.category, cmd: 0 };
      entry.cmd += 1;
      productSales.set(p.id, entry);
    }
  }
  const topProducts = Array.from(productSales.values())
    .sort((a, b) => b.cmd - a.cmd)
    .slice(0, 6)
    .map((p) => ({ name: p.name, cmd: p.cmd }));
  const categoryData = Object.entries(
    Array.from(productSales.values()).reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + p.cmd;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  // Clients calculés depuis les vraies commandes par restaurant
  // (remplace l'ancien tableau topClients figé avec des taux de réachat inventés).
  const clientStats = restaurants
    .map((r) => {
      const rOrders = orders.filter((o) => o.restaurantId === r.id);
      return {
        restaurant: r,
        orders: rOrders.length,
        total: rOrders.reduce((s, o) => s + o.total, 0),
      };
    })
    .filter((c) => c.orders > 0)
    .sort((a, b) => b.orders - a.orders || b.total - a.total);

  const bestClient = clientStats[0]?.restaurant ?? null;
  const repeatRate =
    clientStats.length > 0
      ? Math.round((clientStats.filter((c) => c.orders > 1).length / clientStats.length) * 100)
      : 0;
  const cancelRate =
    orders.length > 0
      ? Math.round((orders.filter((o) => o.status === "cancelled").length / orders.length) * 1000) /
        10
      : 0;

  const lowStockProducts = products.filter((p) => p.status === "low" || p.status === "out");

  // Position géographique réelle des restaurants clients, déduite des points
  // de livraison des missions (seul endroit où de vraies coordonnées existent).
  const restaurantCoords = new Map<string, { lat: number; lng: number }>();
  for (const m of missions) {
    if (!restaurantCoords.has(m.restaurantId)) {
      restaurantCoords.set(m.restaurantId, { lat: m.dropoff.lat, lng: m.dropoff.lng });
    }
  }
  const mapMarkers = clientStats.flatMap((c, i) => {
    const coords = restaurantCoords.get(c.restaurant.id);
    if (!coords) return [];
    return [
      {
        id: c.restaurant.id,
        lat: coords.lat,
        lng: coords.lng,
        label: c.restaurant.name,
        description: `${c.restaurant.city} · ${c.orders} commande(s) · ${formatFCFA(c.total)}`,
        color: (i === 0 ? "emerald" : "blue") as "emerald" | "blue",
        pulse: i === 0,
      },
    ];
  });
  const mapCenter: [number, number] | undefined =
    mapMarkers.length > 0
      ? [
          mapMarkers.reduce((s, m) => s + m.lat, 0) / mapMarkers.length,
          mapMarkers.reduce((s, m) => s + m.lng, 0) / mapMarkers.length,
        ]
      : undefined;

  // Peu de jours couverts par les commandes de démo : agrégation par jour
  // réel plutôt qu'une tendance sur 30 jours simulée.
  const ordersByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of orders) {
      const day = o.createdAt.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + 1);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        orders: count,
      }));
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Performance et tendances de votre exploitation"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "analytics-produits",
                  ["Produit", "Commandes du mois"],
                  topProducts.map((p) => [p.name, p.cmd]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export produits
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Award}
          label="Top produit"
          value={topProducts[0]?.name ?? "—"}
          change={topProducts[0] ? `${topProducts[0].cmd} cmd` : undefined}
          tone="emerald"
        />
        <KpiCard
          icon={Heart}
          label="Meilleur client"
          value={bestClient?.name ?? "—"}
          change={clientStats[0] ? `${clientStats[0].orders} cmd` : undefined}
          tone="rose"
        />
        <KpiCard
          icon={Repeat}
          label="Taux de réachat"
          value={`${repeatRate}%`}
          change="Moy. clients fidèles"
          tone="blue"
        />
        <KpiCard
          icon={XOctagon}
          label="Taux d'annulation"
          value={`${cancelRate}%`}
          change={`${orders.length} commande(s)`}
          tone="amber"
        />
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Répartition géographique des ventes</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {mapMarkers.length > 0
            ? `${mapMarkers.length} client(s) actif(s), positionnés selon les vraies commandes`
            : "Aucune commande livrée pour le moment"}
        </p>
        {mapMarkers.length > 0 ? (
          <DiambarMapLazy
            markers={mapMarkers}
            center={mapCenter}
            zoom={mapMarkers.length > 1 ? 8 : 11}
            minHeight={320}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            La carte apparaîtra dès que vous aurez des commandes.
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h3 className="font-semibold mb-4">Évolution des commandes</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={ordersByDay}>
                <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="oklch(0.75 0.18 50)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4 text-rose-500" />
            <h3 className="font-semibold">Top clients fidèles</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Par volume de commandes</p>
          {clientStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {clientStats.map((c, i) => (
                <div
                  key={c.restaurant.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                    {i + 1}
                  </span>
                  <img
                    src={c.restaurant.avatar}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.restaurant.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.orders} cmd · panier moyen {formatFCFA(Math.round(c.total / c.orders))}
                    </div>
                  </div>
                  <div className="text-xs font-bold text-primary text-right">
                    {formatFCFA(c.total)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <TriangleAlert className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Alertes stock</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Produits en rupture ou en stock bas, à réapprovisionner
        </p>
        {lowStockProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tous vos produits sont bien approvisionnés.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-4 ${p.status === "out" ? "border-rose-500/30 bg-rose-500/5" : "border-amber-500/30 bg-amber-500/5"}`}
              >
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.status === "out"
                    ? "En rupture de stock"
                    : `Stock bas : ${p.stock} ${p.unit} restant(s) (seuil ${p.minStock})`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Produits les plus vendus</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={topProducts}>
                <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  stroke="currentColor"
                  opacity={0.5}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="cmd" fill="oklch(0.7 0.17 155)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Répartition par catégorie</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
