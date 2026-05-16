import { createFileRoute } from "@tanstack/react-router";
import { Award, Heart, Repeat, XOctagon } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { products, revenueChart } from "@/data/mocks";

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

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Performance et tendances de votre exploitation" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Award} label="Top produit" value="Poulet fermier" change="22 cmd" tone="emerald" />
        <KpiCard icon={Heart} label="Meilleur client" value="Le Baobab" change="9 cmd" tone="rose" />
        <KpiCard icon={Repeat} label="Taux de réachat" value="68%" change="+4 pts" tone="blue" />
        <KpiCard icon={XOctagon} label="Taux d'annulation" value="3.2%" change="-1.1 pts" tone="amber" />
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
