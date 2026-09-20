import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Download,
  PiggyBank,
  Save,
  SlidersHorizontal,
  Repeat,
  Users,
  Receipt,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { OrderStatusBadge } from "@/components/farmer/status-badge";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { useBudget, budgetActions } from "@/data/budget";
import {
  useRestaurantOrders,
  useProducts,
  useSuppliers,
  useRecurringOrders,
  useRestaurantProfile,
} from "@/data/store";
import { isInvoiceOverdue } from "@/lib/invoice-data";
import { itemsSubtotal } from "@/lib/recurring-engine";
import { CATEGORY_COLOR } from "@/lib/category-colors";
import type { Product, RestaurantOrder } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/budget")({
  head: () => ({
    meta: [
      { title: "Budget d'achat — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content:
          "Pilotez votre budget mensuel d'approvisionnement : dépenses par catégorie, par fournisseur et alertes de dépassement.",
      },
      { property: "og:title", content: "Budget d'achat — Espace restaurant" },
      {
        property: "og:description",
        content: "Budget mensuel, dépenses par catégorie et alertes de dépassement.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
});

const CATEGORY_MAP: Record<string, string> = {
  Légumes: "legumes",
  Fruits: "fruits",
  Céréales: "cereales",
  Tubercules: "cereales",
  Volaille: "proteines",
  Viande: "proteines",
  Épices: "autres",
};

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthKeyFromIso(iso: string) {
  return iso.slice(0, 7);
}
function monthLabel(d: Date) {
  const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { key: monthKeyOf(d), date: d, label: monthLabel(d) };
  });
}

function dominantCategory(o: RestaurantOrder, products: Product[]) {
  const totals = new Map<string, number>();
  o.items.forEach((it) => {
    const p = products.find((x) => x.id === it.productId);
    const key = p?.category ?? "Autres";
    totals.set(key, (totals.get(key) ?? 0) + it.qty * it.price);
  });
  let best = "Autres";
  let bestVal = -1;
  totals.forEach((v, k) => {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  });
  return best;
}

type Alert = {
  id: string;
  tone: "amber" | "rose" | "blue" | "violet";
  icon: LucideIcon;
  title: string;
  body: string;
  to?: string;
  params?: Record<string, string>;
  ctaLabel: string;
};

const ALERT_TONE: Record<Alert["tone"], string> = {
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  rose: "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400",
  blue: "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400",
  violet: "border-violet-500/30 bg-violet-500/5 text-violet-600 dark:text-violet-400",
};

function BudgetPage() {
  const budget = useBudget();
  const orders = useRestaurantOrders();
  const products = useProducts();
  const suppliers = useSuppliers();
  const profile = useRestaurantProfile();
  const recurringOrders = useRecurringOrders();

  const [tab, setTab] = useState("apercu");
  const [manageOpen, setManageOpen] = useState(false);
  const [draftMonthly, setDraftMonthly] = useState(String(budget.monthly));
  const [draftThreshold, setDraftThreshold] = useState(String(budget.alertThreshold));

  const months = useMemo(() => lastMonths(12), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(months[0].key);
  const selectedMonth = months.find((m) => m.key === selectedMonthKey) ?? months[0];
  const isCurrentMonth = selectedMonthKey === monthKeyOf(new Date());

  const activeOrders = useMemo(() => orders.filter((o) => o.status !== "cancelled"), [orders]);

  const spendForMonth = useCallback(
    (key: string) => {
      const ordersInMonth = activeOrders.filter((o) => monthKeyFromIso(o.createdAt) === key);
      const byCategory: Record<string, number> = {};
      const byRawCategory: Record<string, number> = {};
      const bySupplier: Record<string, number> = {};
      let total = 0;
      ordersInMonth.forEach((o) => {
        bySupplier[o.farmerId] = (bySupplier[o.farmerId] ?? 0) + o.total;
        total += o.total;
        o.items.forEach((it) => {
          const p = products.find((x) => x.id === it.productId);
          const bucket = p ? (CATEGORY_MAP[p.category] ?? "autres") : "autres";
          byCategory[bucket] = (byCategory[bucket] ?? 0) + it.qty * it.price;
          const raw = p?.category ?? "Autres";
          byRawCategory[raw] = (byRawCategory[raw] ?? 0) + it.qty * it.price;
        });
      });
      return { ordersInMonth, byCategory, byRawCategory, bySupplier, total };
    },
    [activeOrders, products],
  );

  const current = useMemo(() => spendForMonth(selectedMonthKey), [selectedMonthKey, spendForMonth]);
  const previous = useMemo(() => {
    const idx = months.findIndex((m) => m.key === selectedMonthKey);
    const prevKey = months[idx + 1]?.key;
    return prevKey ? spendForMonth(prevKey) : null;
  }, [selectedMonthKey, months, spendForMonth]);

  const spent = current.total;
  const remaining = budget.monthly - spent;
  const usage = budget.monthly > 0 ? Math.round((spent / budget.monthly) * 100) : 0;
  const overThreshold = usage >= budget.alertThreshold;

  const daysInMonth = new Date(
    selectedMonth.date.getFullYear(),
    selectedMonth.date.getMonth() + 1,
    0,
  ).getDate();
  const daysElapsed = isCurrentMonth ? new Date().getDate() : daysInMonth;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const avgDaily = daysElapsed > 0 ? spent / daysElapsed : 0;
  const estimatedRemaining = Math.round(avgDaily * daysRemaining);
  const projectedEndOfMonth = spent + estimatedRemaining;
  const budgetRespected = projectedEndOfMonth <= budget.monthly;

  const dailySeries = useMemo(() => {
    const perDay = new Map<number, number>();
    current.ordersInMonth.forEach((o) => {
      const day = new Date(o.createdAt).getDate();
      perDay.set(day, (perDay.get(day) ?? 0) + o.total);
    });
    let cumulative = 0;
    const out: { day: string; "Budget théorique": number; "Dépenses réelles": number | null }[] =
      [];
    for (let day = 1; day <= daysInMonth; day++) {
      cumulative += perDay.get(day) ?? 0;
      out.push({
        day: String(day),
        "Budget théorique": Math.round((budget.monthly / daysInMonth) * day),
        "Dépenses réelles": day <= daysElapsed ? cumulative : null,
      });
    }
    return out;
  }, [current, daysInMonth, daysElapsed, budget.monthly]);

  const donutData = Object.entries(current.byRawCategory).map(([name, value]) => ({ name, value }));

  const overdueOrders = orders.filter((o) => isInvoiceOverdue(o, profile.paymentTermsDays));

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    if (overThreshold) {
      list.push({
        id: "threshold",
        tone: "amber",
        icon: AlertTriangle,
        title: "Budget presque atteint",
        body: `Vous avez utilisé ${usage}% de votre budget mensuel.`,
        ctaLabel: "Voir le détail",
      });
    }
    const topSupplierEntry = Object.entries(current.bySupplier).sort((a, b) => b[1] - a[1])[0];
    if (topSupplierEntry && spent > 0) {
      const [farmerId, amount] = topSupplierEntry;
      const share = Math.round((amount / spent) * 100);
      if (share >= 30) {
        const supplier = suppliers.find((s) => (s.farmerId ?? s.id) === farmerId);
        list.push({
          id: "supplier",
          tone: "blue",
          icon: Users,
          title: "Fournisseur coûteux",
          body: `${supplier?.name ?? "Ce fournisseur"} représente ${share}% de vos dépenses ${isCurrentMonth ? "ce mois-ci" : "sur ce mois"}.`,
          to: supplier ? "/restaurant/suppliers/$supplierId" : undefined,
          params: supplier ? { supplierId: supplier.id } : undefined,
          ctaLabel: "Voir le fournisseur",
        });
      }
    }
    if (previous && previous.total > 0) {
      const catGrowths = Object.entries(current.byCategory)
        .map(([key, amount]) => {
          const prevAmount = previous.byCategory[key] ?? 0;
          const pct = prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : 0;
          const label = budget.categories.find((c) => c.key === key)?.label ?? key;
          return { key, label, pct, amount };
        })
        .filter((c) => c.pct >= 15)
        .sort((a, b) => b.pct - a.pct);
      const top = catGrowths[0];
      if (top) {
        list.push({
          id: "growth",
          tone: "rose",
          icon: TrendingUp,
          title: "Hausse des dépenses",
          body: `Vos dépenses en ${top.label.toLowerCase()} ont augmenté de ${top.pct}% par rapport au mois précédent.`,
          ctaLabel: "Analyser",
        });
      }
    }
    if (isCurrentMonth) {
      const now = Date.now();
      const priceOf = (id: string) => products.find((p) => p.id === id)?.pricePerKg ?? 0;
      const soon = recurringOrders
        .filter((ro) => (ro.status === "active" || ro.status === "problem") && ro.nextRunAt)
        .map((ro) => ({
          ro,
          days: (new Date(ro.nextRunAt!).getTime() - now) / 86_400_000,
        }))
        .filter((x) => x.days >= 0 && x.days <= 3)
        .sort((a, b) => a.days - b.days)[0];
      if (soon) {
        const estimated = itemsSubtotal(soon.ro.items, priceOf);
        const days = Math.max(0, Math.round(soon.days));
        list.push({
          id: "recurring",
          tone: "violet",
          icon: Repeat,
          title: "Commande récurrente prévue",
          body: `Une commande d'environ ${formatFCFA(estimated)} est prévue dans ${days} jour(s).`,
          to: "/restaurant/recurring/$recurringOrderId",
          params: { recurringOrderId: soon.ro.id },
          ctaLabel: "Voir la commande",
        });
      }
    }
    if (overdueOrders.length > 0) {
      list.push({
        id: "overdue",
        tone: "rose",
        icon: Receipt,
        title: "Facture en retard",
        body: `${overdueOrders.length} facture(s) en espèces non réglées depuis plus de ${profile.paymentTermsDays} jours.`,
        to: "/restaurant/invoices",
        ctaLabel: "Voir les factures",
      });
    }
    return list;
  }, [
    overThreshold,
    usage,
    current,
    previous,
    spent,
    suppliers,
    isCurrentMonth,
    recurringOrders,
    products,
    overdueOrders,
    budget.categories,
    profile.paymentTermsDays,
  ]);

  const recentInMonth = [...current.ordersInMonth]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const historyMonths = months.slice(0, 6).map((m) => {
    const s = spendForMonth(m.key);
    return { ...m, spent: s.total, orderCount: s.ordersInMonth.length };
  });
  const chartHistory = [...historyMonths].reverse().map((m) => ({
    month: m.label.split(" ")[0],
    Dépensé: m.spent,
    "Budget actuel (référence)": budget.monthly,
  }));

  const saveBudget = () => {
    budgetActions.setMonthly(Number(draftMonthly) || 0);
    budgetActions.setThreshold(Number(draftThreshold) || 80);
    toast.success("Budget mis à jour");
    setManageOpen(false);
  };

  const exportCsv = () => {
    downloadCsv(
      `budget-restaurant-${selectedMonthKey}.csv`,
      ["Catégorie", "Budget alloué (FCFA)", "Dépensé (FCFA)", "Reste (FCFA)", "Consommation (%)"],
      budget.categories.map((c) => {
        const s = current.byCategory[c.key] ?? 0;
        return [
          c.label,
          c.allocated,
          s,
          c.allocated - s,
          c.allocated ? Math.round((s / c.allocated) * 100) : 0,
        ];
      }),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget d'achat"
        subtitle="Pilotez vos dépenses d'approvisionnement et gardez le contrôle de votre budget"
        actions={
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <Button variant="outline" className="gap-2" onClick={() => setManageOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Gérer mon budget
            </Button>
            <Button className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Exporter le rapport
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Budget mensuel" value={formatFCFA(budget.monthly)} icon={PiggyBank} />
        <KpiCard label="Déjà dépensé" value={formatFCFA(spent)} icon={Wallet} />
        <KpiCard
          label="Solde disponible"
          value={formatFCFA(Math.max(0, remaining))}
          icon={TrendingDown}
        />
        <KpiCard label="Taux de consommation" value={`${usage}%`} icon={AlertTriangle} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="apercu">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="categorie">Par catégorie</TabsTrigger>
          <TabsTrigger value="fournisseur">Par fournisseur</TabsTrigger>
          <TabsTrigger value="historique">Historique des dépenses</TabsTrigger>
        </TabsList>

        <TabsContent value="apercu" className="space-y-6 pt-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 glass rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">État du budget et prévision</h2>
              <div className="relative h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Consommé", value: Math.min(usage, 100) },
                        { name: "Restant", value: Math.max(0, 100 - usage) },
                      ]}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill={overThreshold ? "#ef4444" : "hsl(var(--primary))"} />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{usage}%</div>
                    <div className="text-[11px] text-muted-foreground">consommé</div>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="Budget mensuel" value={formatFCFA(budget.monthly)} />
                <Row label="Dépensé actuellement" value={formatFCFA(spent)} />
                <Row label="Solde disponible" value={formatFCFA(Math.max(0, remaining))} />
                {isCurrentMonth && (
                  <>
                    <Row
                      label="Dépense moyenne quotidienne"
                      value={formatFCFA(Math.round(avgDaily))}
                    />
                    <Row label="Jours restants" value={`${daysRemaining} jour(s)`} />
                    <Row label="Dépense estimée restante" value={formatFCFA(estimatedRemaining)} />
                  </>
                )}
              </div>
              {isCurrentMonth ? (
                <div
                  className={`rounded-xl p-3 flex items-center justify-between gap-2 text-xs font-medium ${budgetRespected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}
                >
                  <span>Prévision de fin de mois : {formatFCFA(projectedEndOfMonth)}</span>
                  <span>{budgetRespected ? "Budget respecté" : "Dépassement prévu"}</span>
                </div>
              ) : (
                <div className="rounded-xl p-3 bg-muted text-xs text-muted-foreground">
                  Mois clos — écart final : {formatFCFA(remaining)}{" "}
                  {remaining >= 0 ? "sous le budget" : "au-dessus du budget"}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 glass rounded-2xl p-5">
              <h2 className="font-semibold">Évolution des dépenses</h2>
              <p className="text-xs text-muted-foreground mb-2">
                {isCurrentMonth
                  ? "Dépenses cumulées réelles vs rythme théorique du budget, jour par jour."
                  : "Dépenses cumulées réelles du mois vs rythme théorique du budget."}
              </p>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v) => (typeof v === "number" ? formatFCFA(v) : "—")}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="Budget théorique"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="Dépenses réelles"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 glass rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold">Alertes & recommandations</h2>
              {alerts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune alerte pour le moment : tout est sous contrôle.
                </p>
              )}
              {alerts.map((a) => (
                <div key={a.id} className={`rounded-xl border p-3 space-y-2 ${ALERT_TONE[a.tone]}`}>
                  <div className="flex items-start gap-2">
                    <a.icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-foreground">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.body}</div>
                    </div>
                  </div>
                  {a.to ? (
                    <Link
                      to={a.to}
                      params={a.params}
                      className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                    >
                      {a.ctaLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <button
                      onClick={() => setTab("categorie")}
                      className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                    >
                      {a.ctaLabel}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">
                Dernières dépenses — {selectedMonth.label}
              </div>
              {recentInMonth.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={Wallet}
                    title="Aucune dépense ce mois-ci"
                    description="Aucune commande n'a été passée sur cette période."
                  />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">Commande</th>
                      <th className="text-left font-medium px-4 py-2 hidden md:table-cell">
                        Fournisseur
                      </th>
                      <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">
                        Catégorie
                      </th>
                      <th className="text-right font-medium px-4 py-2">Montant</th>
                      <th className="text-left font-medium px-4 py-2 hidden md:table-cell">
                        Statut
                      </th>
                      <th className="text-right font-medium px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentInMonth.map((o) => {
                      const supplier = suppliers.find((s) => (s.farmerId ?? s.id) === o.farmerId);
                      const cat = dominantCategory(o, products);
                      return (
                        <tr key={o.id} className="hover:bg-accent/50 transition">
                          <td className="px-4 py-2.5">
                            <div className="font-mono text-xs">{o.reference}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            {supplier?.name ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${CATEGORY_COLOR[cat] ?? "#94a3b8"}22`,
                                color: CATEGORY_COLOR[cat] ?? "#94a3b8",
                              }}
                            >
                              {cat}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">
                            {formatFCFA(o.total)}
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <OrderStatusBadge status={o.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link to="/restaurant/orders/$orderId" params={{ orderId: o.id }}>
                                Voir <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categorie" className="space-y-6 pt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-1">Répartition des dépenses par catégorie</h2>
              <p className="text-xs text-muted-foreground mb-4">{selectedMonth.label}</p>
              <div className="h-64">
                {donutData.length === 0 ? (
                  <p className="text-sm text-muted-foreground flex h-full items-center justify-center">
                    Aucune dépense sur cette période.
                  </p>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {donutData.map((c, i) => (
                          <Cell key={i} fill={CATEGORY_COLOR[c.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => formatFCFA(v)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-semibold">Budgets par catégorie</h2>
                <span className="text-xs text-muted-foreground">
                  Seuil d'alerte : {budget.alertThreshold}%
                </span>
              </div>
              <div className="space-y-4">
                {budget.categories.map((c) => {
                  const s = current.byCategory[c.key] ?? 0;
                  const pct = c.allocated ? Math.min(100, Math.round((s / c.allocated) * 100)) : 0;
                  const danger = pct >= budget.alertThreshold;
                  return (
                    <div key={c.key} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">{c.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatFCFA(s)} / {formatFCFA(c.allocated)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${danger ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Reste {formatFCFA(Math.max(0, c.allocated - s))} · {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setManageOpen(true)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Modifier les enveloppes
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="fournisseur" className="pt-4">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">
              Dépenses par fournisseur — {selectedMonth.label}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fournisseur</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Ville</th>
                  <th className="text-right font-medium px-4 py-3">Dépensé</th>
                  <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                    Part du budget
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...suppliers]
                  .sort(
                    (a, b) =>
                      (current.bySupplier[b.farmerId ?? b.id] ?? 0) -
                      (current.bySupplier[a.farmerId ?? a.id] ?? 0),
                  )
                  .map((s) => {
                    const amount = current.bySupplier[s.farmerId ?? s.id] ?? 0;
                    const share = budget.monthly ? Math.round((amount / budget.monthly) * 100) : 0;
                    return (
                      <tr key={s.id} className="hover:bg-accent/50 transition">
                        <td className="px-4 py-3 font-medium">
                          <Link
                            to="/restaurant/suppliers/$supplierId"
                            params={{ supplierId: s.id }}
                            className="hover:text-primary"
                          >
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                          {s.city}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatFCFA(amount)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, share)}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-xs w-8 text-right">
                              {share}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="historique" className="space-y-6 pt-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Budget vs dépenses (6 derniers mois)</h2>
            <p className="text-xs text-muted-foreground mb-2">
              Dépenses réellement enregistrées, comparées au budget actuel appliqué rétroactivement
              à titre de référence (pas le budget qui était réellement en vigueur à l'époque).
            </p>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartHistory}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatFCFA(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Budget actuel (référence)"
                    fill="hsl(var(--muted-foreground))"
                    radius={[6, 6, 0, 0]}
                    opacity={0.35}
                  />
                  <Bar dataKey="Dépensé" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Mois</th>
                  <th className="text-right font-medium px-4 py-3">Dépensé</th>
                  <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                    Commandes
                  </th>
                  <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                    Évolution
                  </th>
                  <th className="text-right font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyMonths.map((m, i) => {
                  const prevM = historyMonths[i + 1];
                  const delta =
                    prevM && prevM.spent > 0
                      ? Math.round(((m.spent - prevM.spent) / prevM.spent) * 100)
                      : null;
                  return (
                    <tr key={m.key} className="hover:bg-accent/50 transition">
                      <td className="px-4 py-3 font-medium">{m.label}</td>
                      <td className="px-4 py-3 text-right">{formatFCFA(m.spent)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                        {m.orderCount}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {delta == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={delta > 0 ? "text-destructive" : "text-emerald-500"}>
                            {delta > 0 ? "+" : ""}
                            {delta}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMonthKey(m.key);
                            setTab("apercu");
                          }}
                        >
                          Voir <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gérer mon budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Budget mensuel (FCFA)</Label>
              <Input
                type="number"
                value={draftMonthly}
                onChange={(e) => setDraftMonthly(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Seuil d'alerte (%)</Label>
              <Input
                type="number"
                value={draftThreshold}
                onChange={(e) => setDraftThreshold(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Enveloppes par catégorie</Label>
              {budget.categories.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <span className="text-xs flex-1">{c.label}</span>
                  <Input
                    type="number"
                    defaultValue={c.allocated}
                    onBlur={(e) => {
                      budgetActions.setCategory(c.key, Number(e.target.value) || 0);
                      toast.success(`Enveloppe « ${c.label} » mise à jour`);
                    }}
                    className="h-8 max-w-36 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button className="w-full gap-2" onClick={saveBudget}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                budgetActions.reset();
                setDraftMonthly("1200000");
                setDraftThreshold("80");
                toast.success("Budget réinitialisé");
              }}
            >
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
