import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  ShoppingBag,
  Hourglass,
  Download,
  History,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { revenueChart, transactions, restaurants, wallets } from "@/data/mocks";
import { useWithdrawals } from "@/data/store";
import { WalletWidget } from "@/components/farmer/wallet-widget";
import { formatFCFA } from "@/lib/format";
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

function RevenuePage() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const data = useMemo(
    () =>
      period === "7"
        ? revenueChart.slice(-4)
        : period === "30"
          ? revenueChart
          : revenueChart.concat(revenueChart.slice(0, 10)),
    [period],
  );

  const total = data.reduce((a, x) => a + x.revenue, 0);
  const orders = data.reduce((a, x) => a + x.orders, 0);
  const avg = orders > 0 ? Math.round(total / orders) : 0;
  const pending = transactions
    .filter((t) => t.status === "En attente")
    .reduce((a, t) => a + t.net, 0);
  const withdrawals = useWithdrawals();
  const available =
    transactions.filter((t) => t.status === "Payé").reduce((a, t) => a + t.net, 0) -
    withdrawals.filter((w) => w.status === "Effectué").reduce((a, w) => a + w.amount + w.fee, 0);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "Effectué")
    .reduce((a, w) => a + w.amount, 0);

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
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <WalletWidget
          available={Math.max(0, available)}
          pending={pending}
          withdrawn={totalWithdrawn}
        />
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="text-sm font-semibold mb-3">Comptes mobile money</div>
          <div className="grid sm:grid-cols-3 gap-3">
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="CA période"
          value={formatFCFA(total)}
          change="+12%"
          tone="emerald"
        />
        <KpiCard icon={Wallet} label="CA total 2025" value={formatFCFA(2_345_000)} tone="blue" />
        <KpiCard
          icon={ShoppingCart}
          label="Commandes payées"
          value={String(orders)}
          tone="violet"
        />
        <KpiCard icon={ShoppingBag} label="Panier moyen" value={formatFCFA(avg)} tone="amber" />
        <KpiCard icon={Hourglass} label="En attente" value={formatFCFA(pending)} tone="rose" />
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
                    window.location.assign(`/farmer/revenue/${t.id}`);
                  }}
                >
                  <TableCell className="text-sm">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.orderRef}</TableCell>
                  <TableCell className="text-sm">{r?.name}</TableCell>
                  <TableCell className="text-right text-sm">{formatFCFA(t.gross)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    -{formatFCFA(t.commission)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-primary">
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
