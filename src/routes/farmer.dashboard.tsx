import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, ShoppingBag, Package, Star, Plus, ArrowRight, Check, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";
import { formatFCFA, relativeTime } from "@/lib/format";
import { orders, products, restaurants, revenueChart } from "@/data/mocks";

export const Route = createFileRoute("/farmer/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · Diambar Agro" }] }),
  component: Dashboard,
});

const kpis = [
  { label: "Revenus du mois", value: "847 500 FCFA", change: "+12%", icon: TrendingUp, color: "emerald" },
  { label: "Commandes reçues", value: "23", change: "+5 cette sem.", icon: ShoppingBag, color: "blue" },
  { label: "Produits actifs", value: "8/12", change: "publiés", icon: Package, color: "amber" },
  { label: "Note moyenne", value: "4.8 ★", change: "156 avis", icon: Star, color: "violet" },
];

function Dashboard() {
  const pending = orders.filter((o) => o.status === "pending").slice(0, 3);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bonjour, Mamadou 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Voici l'état de votre exploitation aujourd'hui</p>
        </div>
        <Link to="/farmer/products" className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Ajouter un produit
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-${k.color}-500/10 text-${k.color}-500`}>
                <k.icon className="h-5 w-5" />
              </div>
              <span className="text-xs text-emerald-500 font-semibold">{k.change}</span>
            </div>
            <div className="mt-4 font-display text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Évolution de vos revenus</h3>
            <div className="flex gap-1 text-xs">
              {["Semaine", "Mois", "Année"].map((t, i) => (
                <button key={t} className={`px-3 py-1.5 rounded-lg ${i === 1 ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={revenueChart}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.7 0.17 155)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">À traiter maintenant</h3>
          <div className="space-y-3">
            {pending.map((o) => {
              const r = restaurants.find((x) => x.id === o.restaurantId);
              return (
                <div key={o.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{r?.name}</div>
                      <div className="text-xs text-muted-foreground">{o.reference} · {formatFCFA(o.total)}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(o.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold py-1.5"><Check className="h-3 w-3" />Confirmer</button>
                    <button className="px-2.5 rounded-lg border border-border text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <Link to="/farmer/orders" className="mt-4 flex items-center justify-center gap-1 text-sm text-primary font-medium">
            Voir toutes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Produits populaires</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {products.slice(0, 3).map((p) => (
              <Link key={p.id} to="/farmer/products" className="rounded-xl overflow-hidden border border-border hover:border-primary/40 transition group">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-primary font-bold mt-0.5">{formatFCFA(p.pricePerKg)}/{p.unit}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.stock} {p.unit} · {p.ordersThisMonth} cmd</div>
                  {p.status === "low" && <div className="mt-2 text-[10px] text-amber-500 font-medium">⚠ Rupture proche</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Activité récente</h3>
          <div className="space-y-3">
            {[
              { t: "Nouvelle commande", d: "Le Baobab · 42 500 FCFA", time: "2 min", color: "emerald" },
              { t: "Paiement reçu", d: "Wave · 38 250 FCFA", time: "1h", color: "amber" },
              { t: "Stock mis à jour", d: "Tomates +50 kg", time: "3h", color: "blue" },
              { t: "Avis reçu ★ 5", d: "Restaurant Téranga", time: "5h", color: "violet" },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full bg-${a.color}-500`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.t}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.d}</div>
                </div>
                <span className="text-[10px] text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
