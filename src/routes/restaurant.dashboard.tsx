import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShoppingBag,
  Wallet,
  Users,
  TrendingDown,
  Plus,
  ArrowRight,
  Sparkles,
  Clock,
  PackageX,
  Receipt,
  Undo2,
  Phone,
  Star,
  Pencil,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
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
import { toast } from "sonner";
import { BentoKpi } from "@/components/farmer/bento-kpi";
import { OrderStatusBadge } from "@/components/farmer/status-badge";
import {
  useRestaurantOrders,
  useRecurringOrders,
  useProducts,
  useSuppliers,
  useRestaurantBudget,
  restaurantBudgetActions,
  useRestaurantProfile,
  useAllProductReviews,
} from "@/data/store";
import { useReturns, useReviews as useBusinessReviews } from "@/data/business";
import { OnboardingChecklist } from "@/components/common/onboarding-checklist";
import { farmers } from "@/data/mocks";
import { farmerReviewStats } from "@/lib/farmer-stats";
import { CATEGORY_COLOR } from "@/lib/category-colors";
import { isInvoiceOverdue } from "@/lib/invoice-data";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/restaurant/dashboard")({
  head: () => ({ meta: [{ title: "Restaurant · Tableau de bord" }] }),
  component: Dashboard,
});

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function Dashboard() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const navigate = useNavigate();
  const orders = useRestaurantOrders();
  const recurring = useRecurringOrders();
  const products = useProducts();
  const suppliers = useSuppliers();
  const returns = useReturns();
  const productReviews = useAllProductReviews();
  const businessReviews = useBusinessReviews();
  const budget = useRestaurantBudget();
  const profile = useRestaurantProfile();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(budget.monthly));

  // Les commandes de démo sont figées à une date passée : on prend le mois du
  // dernier vrai événement comme "mois courant" plutôt que le mois calendaire
  // réel (qui afficherait un tableau de bord vide face à des données gelées).
  const { refMonth, prevMonth } = useMemo(() => {
    if (orders.length === 0) {
      const now = new Date();
      return { refMonth: monthKey(now.toISOString()), prevMonth: "" };
    }
    const latest = orders.reduce(
      (a, o) => (a > o.createdAt ? a : o.createdAt),
      orders[0].createdAt,
    );
    const d = new Date(latest);
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return { refMonth: monthKey(latest), prevMonth: monthKey(prev.toISOString()) };
  }, [orders]);

  const thisMonthOrders = orders.filter((o) => monthKey(o.createdAt) === refMonth);
  const lastMonthOrders = orders.filter((o) => monthKey(o.createdAt) === prevMonth);
  const monthSpend = thisMonthOrders.reduce((s, o) => s + o.total, 0);
  const lastMonthSpend = lastMonthOrders.reduce((s, o) => s + o.total, 0);
  const ordersTrend =
    lastMonthOrders.length > 0
      ? Math.round(
          ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100,
        )
      : null;
  const spendTrend =
    lastMonthSpend > 0 ? Math.round(((monthSpend - lastMonthSpend) / lastMonthSpend) * 100) : null;

  const active = orders.filter((o) =>
    ["pending", "confirmed", "preparing", "delivering"].includes(o.status),
  );
  const delivering = orders.filter((o) => o.status === "delivering");
  const upcoming = orders.filter((o) => ["pending", "confirmed", "preparing"].includes(o.status));
  const avg = Math.round(monthSpend / Math.max(1, thisMonthOrders.length));
  const lowStockProducts = products
    .filter((p) => p.status === "low" || p.status === "out")
    .slice(0, 4);
  const recurringNeedingAction = recurring.filter((r) => r.status === "problem" && r.pendingAction);

  const avgRating =
    suppliers.length > 0
      ? suppliers.reduce((s, sup) => {
          const f = farmers.find((x) => x.id === sup.farmerId);
          if (!f) return s;
          return (
            s +
            farmerReviewStats(f.id, products, productReviews, f.rating, businessReviews).avgRating
          );
        }, 0) / suppliers.length
      : 0;

  // "En retard" = commande encore en livraison alors que le délai annoncé
  // (eta, ex. "23 min") est dépassé depuis sa création — calcul réel, pas simulé.
  const isLate = (o: (typeof orders)[number]) => {
    if (o.status !== "delivering" || !o.eta) return false;
    const mins = parseInt(o.eta, 10);
    if (!Number.isFinite(mins)) return false;
    return Date.now() > new Date(o.createdAt).getTime() + mins * 60_000;
  };
  const lateOrders = orders.filter(isLate);
  const pendingOrders = orders.filter((o) => o.status === "pending");
  const outOfStock = products.filter((p) => p.status === "out");
  const overdueInvoices = orders.filter((o) => isInvoiceOverdue(o, profile.paymentTermsDays));
  const pendingReturns = returns.filter(
    (r) => r.restaurantName === user.name && r.status === "pending",
  );

  const actionItems = [
    {
      icon: ShoppingBag,
      label: "Commande(s) en attente",
      count: pendingOrders.length,
      to: "/restaurant/orders",
      tone: "amber" as const,
    },
    {
      icon: Clock,
      label: "Livraison(s) en retard",
      count: lateOrders.length,
      to: "/restaurant/orders",
      tone: "rose" as const,
    },
    {
      icon: PackageX,
      label: "Produit(s) en rupture",
      count: outOfStock.length,
      to: "/restaurant/marketplace",
      tone: "rose" as const,
    },
    {
      icon: Receipt,
      label: "Facture(s) impayée(s)",
      count: overdueInvoices.length,
      to: "/restaurant/invoices",
      tone: "violet" as const,
    },
    {
      icon: Undo2,
      label: "Demande(s) de retour",
      count: pendingReturns.length,
      to: "/restaurant/returns",
      tone: "blue" as const,
    },
  ].filter((a) => a.count > 0);

  // Répartition réelle des dépenses par catégorie, calculée depuis les
  // lignes de commandes (comme pour l'Analytics côté producteur).
  const categorySpend = new Map<string, number>();
  for (const o of orders) {
    for (const it of o.items) {
      const p = products.find((pp) => pp.id === it.productId);
      if (!p) continue;
      categorySpend.set(p.category, (categorySpend.get(p.category) ?? 0) + it.qty * it.price);
    }
  }
  const categoryData = Array.from(categorySpend.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const dailySpend = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of thisMonthOrders) {
      const day = o.createdAt.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + o.total);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        total,
      }));
  }, [thisMonthOrders]);

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const favoriteSuppliers = suppliers.filter((s) => s.favorite);

  const budgetPct = Math.min(100, Math.round((monthSpend / Math.max(1, budget.monthly)) * 100));

  const saveBudget = () => {
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Montant invalide");
      return;
    }
    restaurantBudgetActions.setMonthly(value);
    toast.success("Budget mis à jour");
    setBudgetOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bonjour {user.name} 👋</h1>
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
          to="/restaurant/marketplace"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> Nouvelle commande
        </Link>
      </div>

      {actionItems.length > 0 && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="font-display text-base font-bold">À traiter</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {actionItems.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="rounded-xl border border-border p-3 hover:bg-accent/30 transition"
              >
                <div
                  className={`grid h-8 w-8 place-items-center rounded-lg mb-2 ${
                    a.tone === "amber"
                      ? "bg-amber-500/10 text-amber-500"
                      : a.tone === "rose"
                        ? "bg-rose-500/10 text-rose-500"
                        : a.tone === "violet"
                          ? "bg-violet-500/10 text-violet-500"
                          : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="font-display text-xl font-bold">{a.count}</div>
                <div className="text-[11px] text-muted-foreground">{a.label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <BentoKpi
            icon={ShoppingBag}
            label="Commandes du mois"
            value={String(thisMonthOrders.length)}
            trend={
              ordersTrend !== null ? `${ordersTrend >= 0 ? "+" : ""}${ordersTrend}%` : undefined
            }
            tone="amber"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <BentoKpi
            icon={Wallet}
            label="Dépenses du mois"
            value={formatFCFA(monthSpend).replace(" FCFA", "")}
            suffix="FCFA"
            trend={spendTrend !== null ? `${spendTrend >= 0 ? "+" : ""}${spendTrend}%` : undefined}
            tone="emerald"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold">{active.length}</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
              LIVRAISONS EN COURS
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {delivering.length} en route · {upcoming.length} à venir
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500">
              <Users className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold">{suppliers.length}</span>
              <span className="text-xs text-muted-foreground">producteurs</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
              FOURNISSEURS ACTIFS
            </div>
            {avgRating > 0 && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                Note moyenne {avgRating.toFixed(1)}/5
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {recurringNeedingAction.length > 0 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1 text-sm">
            <b>
              {recurringNeedingAction.length} commande(s) récurrente(s) nécessitent votre
              confirmation
            </b>
          </div>
          <Link
            to="/restaurant/recurring"
            className="text-sm font-semibold text-primary inline-flex items-center gap-1"
          >
            Voir <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold mb-1">Évolution des dépenses</h2>
          <p className="text-xs text-muted-foreground mb-4">Ce mois-ci · par jour</p>
          <div className="h-56">
            {dailySpend.length === 0 ? (
              <p className="text-sm text-muted-foreground flex h-full items-center justify-center">
                Aucune commande ce mois-ci.
              </p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={dailySpend}>
                  <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    opacity={0.5}
                  />
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
                  <Bar dataKey="total" fill="oklch(0.7 0.17 155)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold mb-1">Répartition des dépenses</h2>
          <p className="text-xs text-muted-foreground mb-4">Par catégorie de produit</p>
          <div className="h-56">
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground flex h-full items-center justify-center">
                Aucune donnée pour le moment.
              </p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {categoryData.map((c, i) => (
                      <Cell key={i} fill={CATEGORY_COLOR[c.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatFCFA(v)}
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
            )}
          </div>
        </div>
      </div>

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
            <h2 className="font-display text-lg font-bold">Commandes récentes</h2>
            <Link
              to="/restaurant/orders"
              className="text-xs text-primary inline-flex items-center gap-1"
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => {
                  const farmer = farmers.find((f) => f.id === o.farmerId);
                  return (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({ to: "/restaurant/orders/$orderId", params: { orderId: o.id } })
                      }
                    >
                      <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={farmer?.avatar}
                            alt=""
                            className="h-6 w-6 rounded-md object-cover"
                          />
                          <span className="text-sm truncate">{farmer?.farm}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        {formatFCFA(o.total)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Fournisseurs favoris</h2>
          </div>
          {favoriteSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun favori pour le moment.</p>
          ) : (
            favoriteSuppliers.map((s) => {
              const f = farmers.find((x) => x.id === s.farmerId);
              const rating = f
                ? farmerReviewStats(f.id, products, productReviews, f.rating, businessReviews)
                    .avgRating
                : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-border"
                >
                  <img src={f?.avatar} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      {rating != null && (
                        <>
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {rating.toFixed(1)} · {s.totalOrders} cmd
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    href={`tel:${s.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-500" />
            <h2 className="font-display text-lg font-bold">Alertes produits</h2>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte pour le moment.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {lowStockProducts.map((p) => {
                const f = farmers.find((x) => x.id === p.farmerId);
                return (
                  <Link
                    key={p.id}
                    to="/restaurant/marketplace/$productId"
                    params={{ productId: p.id }}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-accent/30"
                  >
                    <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{f?.farm}</div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.status === "out" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"}`}
                    >
                      {p.status === "out" ? "Rupture" : "Stock bas"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Budget d'achat</h2>
            <button
              onClick={() => {
                setBudgetInput(String(budget.monthly));
                setBudgetOpen(true);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="text-sm">
            <span className="font-display text-xl font-bold">{formatFCFA(monthSpend)}</span>
            <span className="text-muted-foreground"> / {formatFCFA(budget.monthly)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${budgetPct >= 100 ? "bg-rose-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">{budgetPct}% du budget mensuel</div>
        </div>
      </div>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Budget d'achat mensuel</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            step="10000"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>
              Annuler
            </Button>
            <Button onClick={saveBudget}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
