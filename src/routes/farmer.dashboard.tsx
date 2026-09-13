import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Star,
  Plus,
  ArrowRight,
  Check,
  X,
  Warehouse,
  Wallet,
} from "lucide-react";
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
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { formatFCFA, formatNumber, relativeTime } from "@/lib/format";
import { restaurants, type AppNotification } from "@/data/mocks";
import {
  useOrders,
  useProducts,
  orderActions,
  useFarmerNotifications,
  farmerNotifActions,
} from "@/data/store";
import { useSupplierScores } from "@/data/business";
import { BentoKpi } from "@/components/farmer/bento-kpi";
import { Sparkline, ProgressCircle } from "@/components/farmer/sparkline";
import { AlertsPanel } from "@/components/farmer/alerts-panel";
import { QuickActions, type QuickAction } from "@/components/farmer/quick-actions";
import { CATEGORY_COLOR } from "@/lib/category-colors";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/farmer/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · Diambar Agro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const products = useProducts();
  const orders = useOrders().filter((o) => o.farmerId === "f1");
  const pending = orders.filter((o) => o.status === "pending").slice(0, 3);
  const delivered = orders.filter((o) => o.status === "delivered");
  const active = products.filter((p) => p.status === "active").length;
  const [period, setPeriod] = useState<"7" | "30" | "12">("30");
  const score = useSupplierScores().find((s) => s.id === "f1");
  const notifications = useFarmerNotifications();
  const navigate = useNavigate();

  // Peu de jours couverts par les commandes de démo : le graphique agrège
  // par jour réel plutôt que de simuler une tendance sur 7/30/365 jours.
  const revenueByDay = useMemo(() => {
    const totals = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const day = o.createdAt.slice(0, 10);
      const cur = totals.get(day) ?? { revenue: 0, orders: 0 };
      totals.set(day, { revenue: cur.revenue + o.total, orders: cur.orders + 1 });
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        revenue: v.revenue,
        orders: v.orders,
      }));
  }, [orders]);
  const revenueThisMonth = delivered.reduce((s, o) => s + o.total, 0);

  // Répartition réelle du CA livré par catégorie de produit (via les lignes
  // de commande), plutôt qu'un flux d'activité simulé.
  const categorySplit = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of delivered) {
      for (const item of o.items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;
        totals.set(product.category, (totals.get(product.category) ?? 0) + item.qty * item.price);
      }
    }
    return Array.from(totals.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [delivered, products]);

  const openNotification = (n: AppNotification) => {
    farmerNotifActions.markRead(n.id);
    if (n.type === "order") navigate({ to: "/farmer/orders" });
    else if (n.type === "payment") navigate({ to: "/farmer/revenue" });
    else if (n.type === "stock") navigate({ to: "/farmer/stock" });
    else if (n.type === "message") navigate({ to: "/farmer/messages" });
  };

  const quickActions: QuickAction[] = [
    { icon: Plus, label: "Ajouter un produit", to: "/farmer/products/new", tone: "emerald" },
    { icon: Warehouse, label: "Gérer le stock", to: "/farmer/stock", tone: "blue" },
    { icon: ShoppingBag, label: "Voir les commandes", to: "/farmer/orders", tone: "violet" },
    { icon: Wallet, label: "Demander un retrait", to: "/farmer/revenue/withdraw", tone: "amber" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bonjour, Mamadou 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          to="/farmer/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> Nouveau produit
        </Link>
      </div>

      <OnboardingChecklist
        storageKey="farmer"
        title="Complétez votre profil producteur"
        items={[
          { key: "farmer_photo", label: "Ajouter une photo de profil" },
          { key: "farmer_farm", label: "Renseigner votre exploitation" },
          { key: "farmer_payment", label: "Connecter un compte Wave/Orange" },
          { key: "farmer_products", label: "Publier vos 3 premiers produits" },
          { key: "farmer_verify", label: "Vérifier votre identité" },
          { key: "farmer_notifs", label: "Activer les notifications" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: TrendingUp,
            label: "REVENUS CE MOIS",
            value: formatNumber(revenueThisMonth),
            suffix: "FCFA",
            trend: `${delivered.length} livrée(s)`,
            tone: "emerald" as const,
            sparkline: <Sparkline data={revenueByDay.map((d) => d.revenue)} />,
          },
          {
            icon: ShoppingBag,
            label: "COMMANDES REÇUES",
            value: String(orders.length),
            trend: `${pending.length} en attente`,
            tone: "amber" as const,
            sparkline: (
              <Sparkline
                data={revenueByDay.map((d) => d.orders)}
                type="bar"
                color="oklch(0.75 0.18 50)"
              />
            ),
          },
        ].map((k, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <BentoKpi {...k}>{k.sparkline}</BentoKpi>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
                <Package className="h-5 w-5" />
              </div>
              <ProgressCircle value={active} max={products.length} color="oklch(0.65 0.2 260)" />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold">{active}</span>
              <span className="text-xs text-muted-foreground">/ {products.length} publiés</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
              PRODUITS ACTIFS
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <BentoKpi
            icon={Star}
            label="NOTE MOYENNE"
            value={score ? score.avg.toFixed(1) : "—"}
            tone="yellow"
            trend={score ? `${score.count} avis` : "Aucun avis"}
          >
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3.5 w-3.5 ${score && s <= Math.round(score.avg) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
          </BentoKpi>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold">Évolution de vos revenus</h3>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="7">7J</TabsTrigger>
                <TabsTrigger value="30">30J</TabsTrigger>
                <TabsTrigger value="12">12M</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={revenueByDay}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="currentColor"
                  opacity={0.1}
                  vertical={false}
                  strokeDasharray="4 4"
                />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                  formatter={(v: number) => formatFCFA(v)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="oklch(0.7 0.17 155)"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">À traiter</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
              {pending.length}
            </span>
          </div>
          <div className="space-y-3">
            {pending.map((o) => {
              const r = restaurants.find((x) => x.id === o.restaurantId);
              return (
                <div key={o.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{r?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.reference} · {formatFCFA(o.total)}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => orderActions.setStatus(o.id, "confirmed")}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 text-white text-xs font-semibold py-1.5"
                    >
                      <Check className="h-3 w-3" />
                      Confirmer
                    </button>
                    <Link
                      to="/farmer/orders/$orderId/refuse"
                      params={{ orderId: o.id }}
                      className="px-2.5 grid place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune commande en attente
              </p>
            )}
          </div>
          <Link
            to="/farmer/orders"
            className="mt-4 flex items-center justify-center gap-1 text-sm text-primary font-medium"
          >
            Voir toutes <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Produits populaires</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[...products]
              .sort((a, b) => b.ordersThisMonth - a.ordersThisMonth)
              .slice(0, 3)
              .map((p) => (
                <Link
                  key={p.id}
                  to="/farmer/products/$productId"
                  params={{ productId: p.id }}
                  className="rounded-xl overflow-hidden border border-border hover:border-primary/40 transition group"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-primary font-bold mt-0.5">
                      {formatFCFA(p.pricePerKg)}/{p.unit}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.stock} {p.unit} · {p.ordersThisMonth} cmd
                    </div>
                    {p.status === "low" && (
                      <div className="mt-2 text-[10px] text-amber-500 font-medium">
                        ⚠ Rupture proche
                      </div>
                    )}
                  </div>
                </Link>
              ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-1">Répartition par catégorie</h3>
          <p className="text-xs text-muted-foreground mb-3">Chiffre d'affaires livré</p>
          {categorySplit.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Pas encore de vente livrée
            </p>
          ) : (
            <>
              <div className="h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySplit}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={categorySplit.length > 1 ? 3 : 0}
                    >
                      {categorySplit.map((c) => (
                        <Cell key={c.category} fill={CATEGORY_COLOR[c.category] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                      formatter={(v: number) => formatFCFA(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="font-display font-bold text-sm text-center px-4">
                    {formatFCFA(revenueThisMonth)}
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 mt-3">
                {categorySplit.map((c) => (
                  <li key={c.category} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLOR[c.category] ?? "#94a3b8" }}
                    />
                    <span className="flex-1 truncate">{c.category}</span>
                    <span className="font-semibold">
                      {Math.round((c.value / revenueThisMonth) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertsPanel
            items={notifications}
            viewAllTo="/farmer/notifications"
            onOpen={openNotification}
          />
        </div>
        <QuickActions actions={quickActions} />
      </div>
    </div>
  );
}
