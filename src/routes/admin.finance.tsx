import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  Undo2,
  Download,
  ShoppingBag,
  CreditCard,
  TriangleAlert,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { payouts } from "@/data/admin-mocks";
import { auditActions, useCommissionTiers } from "@/data/admin-store";
import {
  useOrders,
  useTransactions,
  useWithdrawals,
  useDriverWallet,
  withdrawalActions,
  driverWalletActions,
} from "@/data/store";
import { useRefunds } from "@/data/finance";
import {
  commissionForOrder,
  commissionForAmount,
  deliveredVolumeByFarmer,
  computeCommission,
} from "@/lib/commission";
import { farmers, restaurants } from "@/data/mocks";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Vue financière globale de Diambar Agro : encaissements, commissions, versements et remboursements.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFinance,
});

const PERIODS = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const METHOD_COLOR: Record<string, string> = {
  Wave: "#00d9ff",
  "Orange Money": "#f59e0b",
  "Free Money": "#ef4444",
  Espèces: "#94a3b8",
};

const LONG_PENDING_MS = 24 * 3600_000;

function AdminFinance() {
  const orders = useOrders();
  const tiers = useCommissionTiers();
  const refunds = useRefunds();
  const transactions = useTransactions();
  const withdrawals = useWithdrawals();
  const driverWallet = useDriverWallet();

  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [metric, setMetric] = useState<"collected" | "generated">("collected");

  const periodDays = PERIODS.find((p) => p.key === periodKey)!.days;
  const delivered = orders.filter((o) => o.status === "delivered");
  const gmv = delivered.reduce((s, o) => s + o.total, 0);
  const volumeByFarmer = useMemo(() => deliveredVolumeByFarmer(orders), [orders]);
  const commissionGenerated = computeCommission(orders, tiers);

  // La commission "générée" (théorique, sur toutes les commandes livrées)
  // et la commission "encaissée" (uniquement les transactions au statut
  // "Payé") sont deux notions réellement différentes dans le modèle —
  // aucune commande de démo n'est encore en échec de paiement, donc l'écart
  // reste faible aujourd'hui, mais le calcul est honnête : basé sur le vrai
  // statut de la transaction, pas un pourcentage recalculé pour l'occasion.
  const paidTx = transactions.filter((t) => t.status === "Payé");
  const encaissements = paidTx.reduce((s, t) => s + t.gross, 0);
  const commissionCollected = paidTx.reduce((s, t) => s + t.commission, 0);

  const payoutsPaid = payouts.filter((p) => p.status === "Payé").reduce((s, p) => s + p.amount, 0);
  const payoutsPending = payouts
    .filter((p) => p.status !== "Payé")
    .reduce((s, p) => s + p.amount, 0);

  // Un remboursement payé annule une partie de la vente d'origine : la
  // commission déjà comptée dessus n'est plus réellement acquise. Quand
  // personne d'autre (producteur ou livreur) n'absorbe le reste du montant,
  // c'est une vraie perte pour Diambar Agro, pas juste un dossier classé.
  const paidRefundsWithOrder = useMemo(
    () =>
      refunds
        .filter((r) => r.status === "paid")
        .flatMap((refund) => {
          const order = orders.find((o) => o.reference === refund.orderRef);
          return order ? [{ refund, order }] : [];
        }),
    [refunds, orders],
  );
  const refundedTotal = paidRefundsWithOrder.reduce((s, { refund }) => s + refund.amount, 0);
  const refundedCommission = paidRefundsWithOrder.reduce(
    (s, { refund, order }) => s + commissionForAmount(order, tiers, volumeByFarmer, refund.amount),
    0,
  );
  const netCommission = commissionGenerated - refundedCommission;
  const platformNetCharge = paidRefundsWithOrder.reduce((s, { refund, order }) => {
    if (refund.bornBy === "farmer" || refund.bornBy === "driver") return s;
    const commissionPortion = commissionForAmount(order, tiers, volumeByFarmer, refund.amount);
    return s + (refund.amount - commissionPortion);
  }, 0);

  // Anomalies — uniquement des signaux réels (pas de compteur inventé) :
  // remboursements en échec, remboursements en attente depuis longtemps,
  // retraits agriculteur/livreur bloqués. Ancré sur la donnée la plus
  // récente du jeu de démo plutôt que l'horloge système.
  const refNowRefunds =
    refunds.length > 0
      ? Math.max(...refunds.map((r) => new Date(r.createdAt).getTime()))
      : Date.now();
  const failedRefunds = refunds.filter((r) => r.status === "failed");
  const longPendingRefunds = refunds.filter(
    (r) =>
      r.status === "pending" && refNowRefunds - new Date(r.createdAt).getTime() > LONG_PENDING_MS,
  );
  const stuckFarmerWithdrawals = withdrawals.filter((w) => w.status === "En cours");
  const stuckDriverWithdrawals = driverWallet.transactions.filter(
    (t) => t.kind === "withdrawal" && t.status === "En attente",
  );
  const anomaliesCount =
    failedRefunds.length +
    longPendingRefunds.length +
    stuckFarmerWithdrawals.length +
    stuckDriverWithdrawals.length;

  // Chaque producteur a son propre palier de commission (barème dégressif
  // réel de /admin/settings) selon son volume livré cumulé — le graphique
  // applique donc le vrai taux par producteur, jamais un taux fixe.
  const refNow = useMemo(() => {
    const dates = [
      ...transactions.map((t) => new Date(t.date).getTime()),
      ...orders.map((o) => new Date(o.createdAt).getTime()),
    ];
    return dates.length > 0 ? Math.max(...dates) : Date.now();
  }, [transactions, orders]);

  const chart = useMemo(() => {
    const start = refNow - periodDays * 86_400_000;
    const totals = new Map<string, number>();
    if (metric === "collected") {
      for (const t of paidTx) {
        const time = new Date(t.date).getTime();
        if (time <= start || time > refNow) continue;
        totals.set(t.date, (totals.get(t.date) ?? 0) + t.commission);
      }
    } else {
      for (const o of delivered) {
        const time = new Date(o.createdAt).getTime();
        if (time <= start || time > refNow) continue;
        const day = o.createdAt.slice(0, 10);
        totals.set(day, (totals.get(day) ?? 0) + commissionForOrder(o, tiers, volumeByFarmer));
      }
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        value,
      }));
  }, [paidTx, delivered, tiers, volumeByFarmer, metric, periodDays, refNow]);

  const chartTotal = chart.reduce((s, c) => s + c.value, 0);
  const chartAvg = chart.length > 0 ? Math.round(chartTotal / chart.length) : 0;
  const bestDay = chart.reduce(
    (best, c) => (c.value > (best?.value ?? -1) ? c : best),
    null as (typeof chart)[number] | null,
  );

  const methodBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of paidTx) totals.set(t.method, (totals.get(t.method) ?? 0) + t.gross);
    return Array.from(totals.entries())
      .filter(([, v]) => v > 0)
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidTx]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 8),
    [transactions],
  );

  const nameForRestaurant = (id: string) => restaurants.find((r) => r.id === id)?.name ?? id;
  const nameForFarmer = (id: string) => farmers.find((f) => f.id === id)?.name ?? id;

  const completeFarmerWithdrawal = (id: string, reference: string) => {
    withdrawalActions.markCompleted(id);
    auditActions.log({
      action: "Versement agriculteur confirmé",
      target: reference,
      module: "finance",
      changes: [{ field: "Statut", before: "En cours", after: "Effectué" }],
    });
    toast.success(`${reference} marqué comme effectué`);
  };
  const failFarmerWithdrawal = (id: string, reference: string) => {
    withdrawalActions.markFailed(id);
    auditActions.log({
      action: "Versement agriculteur en échec",
      target: reference,
      module: "finance",
      level: "important",
      status: "failed",
    });
    toast.error(`${reference} marqué en échec`);
  };
  const completeDriverWithdrawal = (id: string, label: string) => {
    driverWalletActions.completeWithdrawal(id);
    auditActions.log({
      action: "Versement livreur confirmé",
      target: label,
      module: "finance",
      changes: [{ field: "Statut", before: "En attente", after: "Complété" }],
    });
    toast.success(`${label} marqué comme effectué`);
  };
  const failDriverWithdrawal = (id: string, label: string) => {
    driverWalletActions.failWithdrawal(id);
    auditActions.log({
      action: "Versement livreur en échec",
      target: label,
      module: "finance",
      level: "important",
      status: "failed",
    });
    toast.error(`${label} marqué en échec`);
  };

  const exportTransactionsCsv = () =>
    downloadCsv(
      "transactions",
      [
        "Date",
        "Commande",
        "Restaurant",
        "Producteur",
        "Brut",
        "Commission",
        "Net",
        "Méthode",
        "Statut",
      ],
      transactions.map((t) => [
        t.date,
        t.orderRef,
        nameForRestaurant(t.restaurantId),
        nameForFarmer(t.farmerId),
        t.gross,
        t.commission,
        t.net,
        t.method,
        t.status,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Vue financière globale de Diambar Agro"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={exportTransactionsCsv}>
              <Download className="h-4 w-4" />
              Transactions CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "versements",
                  [
                    "Référence",
                    "Bénéficiaire",
                    "Rôle",
                    "Montant FCFA",
                    "Méthode",
                    "Statut",
                    "Date",
                  ],
                  payouts.map((p) => [
                    p.reference,
                    p.beneficiary,
                    p.role,
                    p.amount,
                    p.method,
                    p.status,
                    p.date,
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Versements CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Encaissements"
          value={formatFCFA(encaissements)}
          icon={CreditCard}
          hint={`${paidTx.length} transaction(s) payée(s)`}
        />
        <StatCard
          label="Commission encaissée"
          value={formatFCFA(commissionCollected)}
          icon={TrendingUp}
          hint={`Générée : ${formatFCFA(commissionGenerated)}`}
        />
        <StatCard
          label="Volume d'affaires"
          value={formatFCFA(gmv)}
          icon={ShoppingBag}
          hint={`${delivered.length} commande(s) livrée(s)`}
        />
        <StatCard
          label="Anomalies"
          value={String(anomaliesCount)}
          icon={TriangleAlert}
          hint={anomaliesCount > 0 ? "Nécessitent une action" : "Rien à signaler"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Versements effectués" value={formatFCFA(payoutsPaid)} icon={Wallet} />
        <StatCard
          label="Versements en attente"
          value={formatFCFA(payoutsPending)}
          icon={Receipt}
          hint={`${payouts.filter((p) => p.status !== "Payé").length} opération(s)`}
        />
        <StatCard
          label="Remboursements payés"
          value={formatFCFA(refundedTotal)}
          icon={Undo2}
          hint={`${paidRefundsWithOrder.length} dossier(s)`}
        />
        <StatCard
          label="Charge nette plateforme"
          value={formatFCFA(platformNetCharge)}
          icon={TrendingDown}
          hint={`Commission nette : ${formatFCFA(netCommission)}`}
        />
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              Commission {metric === "collected" ? "encaissée" : "générée"} par jour
            </h2>
            <p className="text-xs text-muted-foreground">
              {metric === "collected"
                ? "Argent effectivement reçu (transactions au statut Payé)"
                : "Commission théorique calculée sur les commandes livrées"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
              <TabsList>
                <TabsTrigger value="collected">Encaissée</TabsTrigger>
                <TabsTrigger value="generated">Générée</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={periodKey} onValueChange={(v) => setPeriodKey(v as PeriodKey)}>
              <TabsList>
                {PERIODS.map((p) => (
                  <TabsTrigger key={p.key} value={p.key}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Total sur la période</div>
            <div className="mt-0.5 font-display text-lg font-bold">{formatFCFA(chartTotal)}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Moyenne / jour</div>
            <div className="mt-0.5 font-display text-lg font-bold">{formatFCFA(chartAvg)}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Meilleur jour</div>
            <div className="mt-0.5 font-display text-lg font-bold">
              {bestDay ? formatFCFA(bestDay.value) : "—"}
            </div>
            {bestDay && <div className="text-[11px] text-muted-foreground">{bestDay.day}</div>}
          </div>
        </div>

        <div className="h-56 mt-4">
          {chart.length === 0 ? (
            <p className="h-full grid place-items-center text-sm text-muted-foreground">
              Aucune donnée sur cette période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="commissionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatFCFA(v)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#commissionFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Encaissements par méthode</h2>
          <div className="h-48 mt-2">
            {methodBreakdown.length === 0 ? (
              <p className="h-full grid place-items-center text-sm text-muted-foreground">
                Aucun encaissement.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodBreakdown}
                    dataKey="value"
                    nameKey="method"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {methodBreakdown.map((m) => (
                      <Cell key={m.method} fill={METHOD_COLOR[m.method] ?? "#8b5cf6"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatFCFA(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {methodBreakdown.map((m) => (
              <li key={m.method} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: METHOD_COLOR[m.method] ?? "#8b5cf6" }}
                />
                {m.method}
                <span className="ml-auto text-muted-foreground">{formatFCFA(m.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2.5">
          <h2 className="font-semibold flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            Anomalies financières
          </h2>
          {anomaliesCount === 0 ? (
            <p className="text-sm text-muted-foreground">Rien à signaler.</p>
          ) : (
            <>
              {failedRefunds.map((r) => (
                <Link
                  key={r.id}
                  to="/admin/refunds/$refundId"
                  params={{ refundId: r.id }}
                  className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs hover:bg-red-500/10"
                >
                  <span>🔴 Remboursement en échec — {r.reference}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
              {longPendingRefunds.map((r) => (
                <Link
                  key={r.id}
                  to="/admin/refunds/$refundId"
                  params={{ refundId: r.id }}
                  className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs hover:bg-amber-500/10"
                >
                  <span>⚠ Remboursement en attente depuis plus de 24h — {r.reference}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
              {stuckFarmerWithdrawals.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                  <span>
                    ⚠ {stuckFarmerWithdrawals.length} retrait(s) agriculteur en attente de
                    confirmation
                  </span>
                </div>
              )}
              {stuckDriverWithdrawals.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs">
                  <span>
                    ⚠ {stuckDriverWithdrawals.length} retrait(s) livreur en attente de confirmation
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">
          Transactions récentes
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Date</th>
              <th className="text-left font-medium px-4 py-3">Commande</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Producteur</th>
              <th className="text-right font-medium px-4 py-3">Brut</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">Commission</th>
              <th className="text-right font-medium px-4 py-3">Net</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3 text-xs">
                  {new Date(t.date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {t.orderRef}
                  {t.kind === "refund_adjustment" && (
                    <span className="ml-1.5 text-muted-foreground">(ajustement)</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{nameForFarmer(t.farmerId)}</td>
                <td className="px-4 py-3 text-right">{formatFCFA(t.gross)}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                  {t.commission >= 0 ? "-" : "+"}
                  {formatFCFA(Math.abs(t.commission))}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${t.net < 0 ? "text-destructive" : "text-primary"}`}
                >
                  {formatFCFA(t.net)}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge value={t.status} label={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Versements en attente de confirmation</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Retraits réels de l'agriculteur et du livreur connectés à cette démo.
          </p>
          {stuckFarmerWithdrawals.length === 0 && stuckDriverWithdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun versement en attente.</p>
          ) : (
            <>
              {stuckFarmerWithdrawals.map((w) => (
                <div key={w.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{w.reference} · Mamadou Diallo</span>
                    <span className="text-muted-foreground">{relativeTime(w.date)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFCFA(w.amount - w.fee)} net · {w.method}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => completeFarmerWithdrawal(w.id, w.reference)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Marquer effectué
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive"
                      onClick={() => failFarmerWithdrawal(w.id, w.reference)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Marquer en échec
                    </Button>
                  </div>
                </div>
              ))}
              {stuckDriverWithdrawals.map((t) => (
                <div key={t.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t.label} · Oumar Ba</span>
                    <span className="text-muted-foreground">{relativeTime(t.at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFCFA(Math.abs(t.amount))} · {t.method}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => completeDriverWithdrawal(t.id, t.label)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Marquer effectué
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive"
                      onClick={() => failDriverWithdrawal(t.id, t.label)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Marquer en échec
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-semibold text-sm">Versements partenaires</div>
            <p className="text-xs text-muted-foreground">
              Aperçu multi-bénéficiaires (données de synthèse, distinctes des retraits réels
              ci-contre)
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Bénéficiaire</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Rôle</th>
                <th className="text-right font-medium px-4 py-3">Montant</th>
                <th className="text-left font-medium px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-accent/50 transition">
                  <td className="px-4 py-3 font-medium">{p.beneficiary}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <RoleBadge role={p.role} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatFCFA(p.amount)}</td>
                  <td className="px-4 py-3">
                    <AdminBadge value={p.status} label={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
