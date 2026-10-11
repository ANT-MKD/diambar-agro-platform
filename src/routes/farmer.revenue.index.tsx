import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  ShoppingBag,
  Hourglass,
  Download,
  History,
  Plus,
  FileText,
  Settings,
  Sparkles,
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
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { QuickActions, type QuickAction } from "@/components/farmer/quick-actions";
import { restaurants, wallets } from "@/data/mocks";
import { useWithdrawals, useWallets, useTransactions, usePaymentPrefs } from "@/data/store";
import { WalletWidget } from "@/components/farmer/wallet-widget";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/farmer/revenue/")({
  head: () => ({ meta: [{ title: "Revenus · Diambar Agro" }] }),
  component: RevenuePage,
});

const PERIOD_DAYS = { "7": 7, "30": 30, "90": 90 } as const;
const METHOD_COLOR: Record<string, string> = Object.fromEntries(
  wallets.map((w) => [w.method, w.color]),
);
METHOD_COLOR["Espèces"] = "#94a3b8";

const quickActions: QuickAction[] = [
  { icon: Plus, label: "Demander un retrait", to: "/farmer/revenue/withdraw", tone: "emerald" },
  { icon: History, label: "Voir l'historique", to: "/farmer/revenue/withdrawals", tone: "blue" },
  { icon: FileText, label: "Voir mes commandes", to: "/farmer/orders", tone: "violet" },
  {
    icon: Settings,
    label: "Paramètres de paiement",
    to: "/farmer/settings/payments",
    tone: "amber",
  },
];

const MY_FARMER_ID = "f1";

function RevenuePage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const withdrawals = useWithdrawals();
  const wallets = useWallets();
  const paymentPrefs = usePaymentPrefs();
  const transactions = useTransactions().filter((t) => t.farmerId === MY_FARMER_ID);

  // Le graphique agrège les vraies transactions par jour réel, filtrées aux
  // N derniers jours disponibles (les dates de démo étant fixes, un filtre
  // par date calendaire ferait disparaître toutes les données).
  const byDay = useMemo(() => {
    const totals = new Map<string, { revenue: number; orders: number }>();
    for (const t of transactions) {
      const cur = totals.get(t.date) ?? { revenue: 0, orders: 0 };
      totals.set(t.date, { revenue: cur.revenue + t.net, orders: cur.orders + 1 });
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        day: new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        revenue: v.revenue,
        orders: v.orders,
      }));
  }, [transactions]);
  const data = useMemo(() => byDay.slice(-PERIOD_DAYS[period]), [byDay, period]);

  const total = data.reduce((a, x) => a + x.revenue, 0);
  const orders = data.reduce((a, x) => a + x.orders, 0);
  const avg = orders > 0 ? Math.round(total / orders) : 0;
  const totalAllTime = transactions.reduce((a, t) => a + t.net, 0);
  const pending = transactions
    .filter((t) => t.status === "En attente")
    .reduce((a, t) => a + t.net, 0);
  // Un retrait "En cours" réserve déjà les fonds : seul un retrait en échec
  // les rend disponibles à nouveau (sinon un même solde pourrait être retiré
  // plusieurs fois tant que le retrait précédent n'est pas marqué "Effectué").
  const available =
    transactions.filter((t) => t.status === "Payé").reduce((a, t) => a + t.net, 0) -
    withdrawals
      .filter((w) => w.status !== "Échec")
      // Les frais sont prélevés sur le montant retiré (reçu = montant − frais) :
      // seul le montant retiré sort du solde, pas montant + frais.
      .reduce((a, w) => a + w.amount, 0);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "Effectué")
    .reduce((a, w) => a + w.amount, 0);

  const revenueByMethod = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of transactions) {
      totals.set(t.method, (totals.get(t.method) ?? 0) + t.net);
    }
    return Array.from(totals.entries())
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const recentWithdrawals = [...withdrawals]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const exportCsv = () => {
    const rows = [["date", "ref", "restaurant", "brut", "commission", "net", "méthode", "statut"]];
    transactions.forEach((t) => {
      const r = restaurants.find((x) => x.id === t.restaurantId);
      rows.push([
        t.date,
        t.orderRef,
        r?.name || "",
        String(t.gross),
        String(t.commission),
        String(t.net),
        t.method,
        t.status,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenus-diambar.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes revenus"
        subtitle="Suivi de votre chiffre d'affaires"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/farmer/revenue/withdrawals">
                <History className="h-4 w-4" />
                Historique retraits
              </Link>
            </Button>
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" />
              Exporter CSV
            </Button>
            <Button asChild className="gap-2">
              <Link to="/farmer/revenue/withdraw">
                <Plus className="h-4 w-4" />
                Demander un retrait
              </Link>
            </Button>
          </div>
        }
      />

      {available >= paymentPrefs.withdrawThreshold && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-primary/30 bg-primary/5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-semibold">Solde disponible : {formatFCFA(available)}.</span>{" "}
            <span className="text-muted-foreground">
              Il dépasse votre seuil de retrait ({formatFCFA(paymentPrefs.withdrawThreshold)}).
            </span>
          </div>
          <Button asChild size="sm" className="gap-2 shrink-0">
            <Link to="/farmer/revenue/withdraw">
              <Plus className="h-4 w-4" />
              Retirer
            </Link>
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <WalletWidget
          available={Math.max(0, available)}
          pending={pending}
          withdrawn={totalWithdrawn}
        />
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="text-sm font-semibold mb-3">Comptes mobile money</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {wallets.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-border p-4 relative overflow-hidden"
              >
                <div
                  className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-15"
                  style={{ background: w.color }}
                />
                <div className="text-xs text-muted-foreground">{w.method}</div>
                <div className="font-display text-lg font-bold mt-1">{formatFCFA(w.balance)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{w.phone}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={TrendingUp} label="CA période" value={formatFCFA(total)} tone="emerald" />
        <KpiCard icon={Wallet} label="CA total" value={formatFCFA(totalAllTime)} tone="blue" />
        <KpiCard
          icon={ShoppingCart}
          label="Commandes payées"
          value={String(orders)}
          tone="violet"
        />
        <KpiCard icon={ShoppingBag} label="Panier moyen" value={formatFCFA(avg)} tone="amber" />
        <KpiCard icon={Hourglass} label="En attente" value={formatFCFA(pending)} tone="rose" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Répartition par méthode</h3>
          <p className="text-xs text-muted-foreground mb-3">Revenus nets</p>
          {revenueByMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucune transaction</p>
          ) : (
            <>
              <div className="h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByMethod}
                      dataKey="value"
                      nameKey="method"
                      innerRadius={40}
                      outerRadius={58}
                      paddingAngle={revenueByMethod.length > 1 ? 3 : 0}
                    >
                      {revenueByMethod.map((m) => (
                        <Cell key={m.method} fill={METHOD_COLOR[m.method] ?? "#94a3b8"} />
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
                    {formatFCFA(totalAllTime)}
                  </div>
                </div>
              </div>
              <ul className="space-y-1.5 mt-3">
                {revenueByMethod.map((m) => (
                  <li key={m.method} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: METHOD_COLOR[m.method] ?? "#94a3b8" }}
                    />
                    <span className="flex-1 truncate">{m.method}</span>
                    <span className="font-semibold">
                      {Math.round((m.value / totalAllTime) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Dernières demandes de retrait</h3>
            <Link to="/farmer/revenue/withdrawals" className="text-xs text-primary font-medium">
              Voir tout
            </Link>
          </div>
          {recentWithdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune demande</p>
          ) : (
            <div className="space-y-3">
              {recentWithdrawals.map((w) => (
                <div key={w.id} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{formatFCFA(w.amount)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {w.reference} · {w.method}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        w.status === "Effectué"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : w.status === "En cours"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {w.status}
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {relativeTime(w.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <QuickActions actions={quickActions} />
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold">Évolution du chiffre d'affaires</h3>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="7">7 jours</TabsTrigger>
              <TabsTrigger value="30">30 jours</TabsTrigger>
              <TabsTrigger value="90">90 jours</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.7 0.17 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="currentColor" opacity={0.1} vertical={false} />
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
                fill="url(#rev2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Transactions</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Commande</TableHead>
              <TableHead>Restaurant</TableHead>
              <TableHead className="text-right">Brut</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const r = restaurants.find((x) => x.id === t.restaurantId);
              return (
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    navigate({ to: "/farmer/revenue/$txId", params: { txId: t.id } });
                  }}
                >
                  <TableCell className="text-sm">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.orderRef}
                    {t.kind === "refund_adjustment" && (
                      <span className="ml-1.5 text-muted-foreground">(ajustement)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r?.name}</TableCell>
                  <TableCell className="text-right text-sm">{formatFCFA(t.gross)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {t.commission >= 0 ? "-" : "+"}
                    {formatFCFA(Math.abs(t.commission))}
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-semibold ${t.net < 0 ? "text-destructive" : "text-primary"}`}
                  >
                    {formatFCFA(t.net)}
                  </TableCell>
                  <TableCell className="text-sm">{t.method}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        t.status === "Payé"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : t.status === "En attente"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {t.status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
