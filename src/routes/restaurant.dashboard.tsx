import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag, Wallet, Users, TrendingDown, Plus, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { BentoKpi } from "@/components/farmer/bento-kpi";
import { Sparkline, ProgressCircle } from "@/components/farmer/sparkline";
import { useRestaurantOrders, useRecurring } from "@/data/store";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { products, farmers, suppliers, sparklineOrders, sparklineRevenue } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/dashboard")({
  head: () => ({ meta: [{ title: "Restaurant · Tableau de bord" }] }),
  component: Dashboard,
});

function Dashboard() {
  const orders = useRestaurantOrders();
  const recurring = useRecurring();
  const active = orders.filter((o) => ["pending", "confirmed", "preparing", "delivering"].includes(o.status));
  const monthSpend = orders.reduce((s, o) => s + o.total, 0);
  const avg = Math.round(monthSpend / Math.max(1, orders.length));
  const lowStockProducts = products.filter((p) => p.status === "low" || p.status === "out").slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  const todaysRecurring = recurring.filter((r) => r.active && r.nextDelivery === today);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bienvenue, Le Baobab 🍽️</h1>
          <p className="text-sm text-muted-foreground mt-1">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Link to="/restaurant/marketplace" className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Nouvelle commande
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ShoppingBag, label: "COMMANDES CE MOIS", value: String(orders.length), trend: "↑ +3 vs sem. dern.", tone: "amber" as const, sparkline: <Sparkline data={sparklineOrders} type="bar" color="oklch(0.75 0.18 50)" /> },
          { icon: Wallet, label: "DÉPENSES", value: formatFCFA(monthSpend).replace(" FCFA", ""), suffix: "FCFA", trend: "↓ -8% optimisé", tone: "emerald" as const, sparkline: <Sparkline data={sparklineRevenue} /> },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <BentoKpi {...k}>{k.sparkline}</BentoKpi>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><Users className="h-5 w-5" /></div>
              <ProgressCircle value={suppliers.filter((s) => s.favorite).length} max={suppliers.length} color="oklch(0.65 0.2 260)" />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5"><span className="font-display text-2xl font-bold">{suppliers.length}</span><span className="text-xs text-muted-foreground">producteurs</span></div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">FOURNISSEURS</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Sparkles className="h-5 w-5" /></div>
            <div className="mt-4 flex items-baseline gap-1.5"><span className="font-display text-2xl font-bold">{formatFCFA(avg).replace(" FCFA", "")}</span><span className="text-xs text-muted-foreground">FCFA</span></div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">PANIER MOYEN</div>
          </div>
        </motion.div>
      </div>

      {todaysRecurring.length > 0 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-primary/30 bg-primary/5">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 text-sm"><b>{todaysRecurring.length} commande(s) récurrente(s) à valider aujourd'hui</b></div>
          <Link to="/restaurant/recurring" className="text-sm font-semibold text-primary inline-flex items-center gap-1">Voir <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}

      <OnboardingChecklist
        storageKey="restaurant"
        title="Configurez votre restaurant"
        items={[
          { key: "resto_profile", label: "Compléter le profil du restaurant" },
          { key: "resto_address", label: "Ajouter l'adresse de livraison" },
          { key: "resto_payment", label: "Configurer un moyen de paiement" },
          { key: "resto_first_order", label: "Passer votre première commande" },
          { key: "resto_team", label: "Inviter votre équipe" },
          { key: "resto_recurring", label: "Programmer une commande récurrente" },
        ]}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Commandes en cours</h2>
            <Link to="/restaurant/orders" className="text-xs text-primary inline-flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande active.</p>}
          {active.map((o) => {
            const farmer = farmers.find((f) => f.id === o.farmerId);
            return (
              <Link key={o.id} to="/restaurant/orders/$orderId" params={{ orderId: o.id }} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/30">
                <img src={farmer?.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{o.reference} · {farmer?.farm}</div>
                  <div className="text-[11px] text-muted-foreground">{relativeTime(o.createdAt)} · {o.items.length} article(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-primary">{formatFCFA(o.total)}</div>
                  {o.eta && <div className="text-[10px] text-muted-foreground">ETA {o.eta}</div>}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-rose-500" /><h2 className="font-display text-lg font-bold">Alertes stock fournisseurs</h2></div>
          {lowStockProducts.map((p) => {
            const f = farmers.find((x) => x.id === p.farmerId);
            return (
              <Link key={p.id} to="/restaurant/marketplace/$productId" params={{ productId: p.id }} className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-accent/30">
                <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{f?.farm}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === "out" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"}`}>{p.status === "out" ? "Rupture" : "Stock bas"}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}