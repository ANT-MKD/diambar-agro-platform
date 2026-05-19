import { createFileRoute } from "@tanstack/react-router";
import { Award, Heart, Repeat, XOctagon, Sparkles, TrendingUp, MapPin } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { SenegalMap } from "@/components/farmer/senegal-map";
import { products, revenueChart, restaurants, topClients } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/farmer/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Diambar Agro" }] }),
  component: AnalyticsPage,
});

const COLORS = ["oklch(0.7 0.17 155)", "oklch(0.75 0.18 50)", "oklch(0.65 0.2 260)", "oklch(0.8 0.18 80)", "oklch(0.7 0.2 20)", "oklch(0.7 0.15 320)"];

function AnalyticsPage() {
  const topProducts = [...products].sort((a, b) => b.ordersThisMonth - a.ordersThisMonth).slice(0, 6).map((p) => ({ name: p.name, cmd: p.ordersThisMonth }));
  const categoryData = Object.entries(products.reduce<Record<string, number>>((acc, p) => { acc[p.category] = (acc[p.category] || 0) + p.ordersThisMonth; return acc; }, {})).map(([name, value]) => ({ name, value }));

  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const hours = ["6h", "9h", "12h", "15h", "18h", "21h"];
  const heatmap = days.map((d) => ({ day: d, values: hours.map(() => Math.floor(Math.random() * 9)) }));

  // Radar : performance multi-critères
  const radarData = [
    { criterion: "Volume", score: 82 },
    { criterion: "Qualité", score: 91 },
    { criterion: "Ponctualité", score: 88 },
    { criterion: "Prix", score: 74 },
    { criterion: "Diversité", score: 68 },
    { criterion: "Service", score: 85 },
  ];

  // Prédictions : extrapolation linéaire simple basée sur revenueChart
  const last = revenueChart.slice(-7);
  const slope = (last[last.length - 1].revenue - last[0].revenue) / (last.length - 1);
  const baseDay = parseInt(last[last.length - 1].day, 10);
  const predictions = Array.from({ length: 7 }, (_, i) => ({
    day: String(baseDay + i + 1).padStart(2, "0"),
    forecast: Math.max(0, Math.round(last[last.length - 1].revenue + slope * (i + 1) * 0.9 + (Math.sin(i) * 4000))),
  }));
  const totalForecast = predictions.reduce((a, x) => a + x.forecast, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Performance et tendances de votre exploitation" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Award} label="Top produit" value="Poulet fermier" change="22 cmd" tone="emerald" />
        <KpiCard icon={Heart} label="Meilleur client" value="Le Baobab" change="9 cmd" tone="rose" />
        <KpiCard icon={Repeat} label="Taux de réachat" value="68%" change="+4 pts" tone="blue" />
        <KpiCard icon={XOctagon} label="Taux d'annulation" value="3.2%" change="-1.1 pts" tone="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1"><MapPin className="h-4 w-4 text-primary" /><h3 className="font-semibold">Répartition géographique des ventes</h3></div>
          <p className="text-xs text-muted-foreground mb-4">Commandes par région · 30 derniers jours</p>
          <SenegalMap />
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-1">Performance globale</h3>
          <p className="text-xs text-muted-foreground mb-4">Score sur 100 · moyenne 81</p>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="currentColor" opacity={0.15} />
                <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10, fill: "currentColor" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar dataKey="score" stroke="oklch(0.7 0.17 155)" fill="oklch(0.7 0.17 155)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Prédiction des revenus (7 jours)</h3></div>
            <span className="text-xs text-muted-foreground">Modèle linéaire · niveau de confiance 78%</span>
          </div>
          <div className="text-xs text-muted-foreground mb-4">Projection basée sur les 7 derniers jours · prévision totale : <b className="text-primary">{formatFCFA(totalForecast)}</b></div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={[...last.map((x) => ({ day: x.day, real: x.revenue, forecast: undefined })), ...predictions.map((x) => ({ day: x.day, real: undefined, forecast: x.forecast }))]}>
                <defs>
                  <linearGradient id="real" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0.45} /><stop offset="100%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0} /></linearGradient>
                  <linearGradient id="forecast" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="oklch(0.7 0.2 260)" stopOpacity={0.45} /><stop offset="100%" stopColor="oklch(0.7 0.2 260)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} formatter={(v: number) => formatFCFA(v)} />
                <Area type="monotone" dataKey="real" stroke="oklch(0.7 0.17 155)" strokeWidth={2.5} fill="url(#real)" />
                <Area type="monotone" dataKey="forecast" stroke="oklch(0.7 0.2 260)" strokeDasharray="5 3" strokeWidth={2.5} fill="url(#forecast)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1"><Heart className="h-4 w-4 text-rose-500" /><h3 className="font-semibold">Top clients fidèles</h3></div>
          <p className="text-xs text-muted-foreground mb-4">Par volume de commandes</p>
          <div className="space-y-3">
            {topClients.map((c, i) => {
              const r = restaurants.find((x) => x.id === c.restaurantId);
              return (
                <div key={c.restaurantId} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">{i + 1}</span>
                  <img src={r?.avatar} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r?.name}</div>
                    <div className="text-[11px] text-muted-foreground">{c.orders} cmd · {c.recurringPct}% récurrentes</div>
                  </div>
                  <div className="text-xs font-bold text-primary text-right">{formatFCFA(c.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-emerald-500" /><h3 className="font-semibold">Recommandations IA</h3></div>
        <p className="text-xs text-muted-foreground mb-4">Insights basés sur vos données des 30 derniers jours</p>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { tone: "emerald", title: "Augmentez le stock de Poulet fermier", body: "+22 commandes ce mois, ruptures probables d'ici 4 jours." },
            { tone: "amber", title: "Lancez une promo sur les Mangues Kent", body: "0 vente cette semaine — proposez -15% pour relancer la demande." },
            { tone: "blue", title: "Saint-Louis est sous-exploité", body: "Seulement 3 commandes — contactez 5 restaurants locaux pour ouvrir le marché." },
          ].map((tip, i) => (
            <div key={i} className={`rounded-xl border p-4 ${tip.tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" : tip.tone === "amber" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
              <div className="font-semibold text-sm">{tip.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{tip.body}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Produits les plus vendus</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={topProducts}>
                <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
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
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Évolution des commandes (30j)</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={revenueChart}>
              <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
              <Line type="monotone" dataKey="orders" stroke="oklch(0.75 0.18 50)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Heatmap des commandes (jour × heure)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr><th></th>{hours.map((h) => <th key={h} className="font-medium text-muted-foreground pb-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.day}>
                  <td className="pr-2 text-muted-foreground font-medium">{row.day}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="p-1">
                      <div className="aspect-square rounded-md grid place-items-center font-semibold text-foreground"
                        style={{ background: `color-mix(in oklab, oklch(0.7 0.17 155) ${v * 11}%, transparent)` }}>
                        {v}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
