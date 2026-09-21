import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Banknote,
  Check,
  X,
  Download,
  Plus,
  Search,
  Wallet,
  Clock,
  TriangleAlert,
  RotateCcw,
  Gift,
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
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";
import { auditActions, useCommissionTiers } from "@/data/admin-store";
import { useRefundSettings } from "@/data/admin-store";
import { useOrders, transactionActions } from "@/data/store";
import { commissionForAmount, deliveredVolumeByFarmer } from "@/lib/commission";
import {
  useRefunds,
  refundActions,
  REFUND_SOURCE_LABEL,
  REFUND_STATUS_LABEL,
  REFUND_BORN_BY_LABEL,
  type RefundStatus,
  type RefundSource,
  type RefundMethod,
  type Refund,
} from "@/data/finance";

export const Route = createFileRoute("/admin/refunds/")({
  head: () => ({
    meta: [
      { title: "Remboursements — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Centre de résolution financière : remboursements, retours, incidents et gestes commerciaux.",
      },
      { property: "og:title", content: "Remboursements — Administration" },
      {
        property: "og:description",
        content: "Centre de résolution financière de la plateforme Diambar Agro.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RefundsPage,
});

const TABS: { key: RefundStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "À traiter" },
  { key: "approved", label: "En cours" },
  { key: "paid", label: "Remboursés" },
  { key: "failed", label: "Échecs" },
  { key: "rejected", label: "Rejetés" },
];

const STATUS_CLASS: Record<RefundStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const SOURCE_COLOR: Record<RefundSource, string> = {
  dispute: "#ef4444",
  incident: "#f59e0b",
  return: "#3b82f6",
  manual: "#8b5cf6",
};

const METHODS: RefundMethod[] = ["Wave", "Orange Money", "Free Money", "Virement"];
const LONG_PENDING_MS = 24 * 3600_000;

function AmountForm({
  requester,
  orderRef,
  amount,
  method,
  reason,
  onChange,
}: {
  requester: string;
  orderRef: string;
  amount: string;
  method: RefundMethod;
  reason: string;
  onChange: (
    patch: Partial<{
      requester: string;
      orderRef: string;
      amount: string;
      method: RefundMethod;
      reason: string;
    }>,
  ) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Bénéficiaire</label>
        <Input
          placeholder="Le Baobab"
          value={requester}
          onChange={(e) => onChange({ requester: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Commande liée</label>
        <Input
          placeholder="CMD-2851"
          value={orderRef}
          onChange={(e) => onChange({ orderRef: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Montant (FCFA)</label>
        <Input
          inputMode="numeric"
          placeholder="5000"
          value={amount}
          onChange={(e) => onChange({ amount: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Moyen</label>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ method: m })}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${method === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Motif</label>
        <Textarea
          placeholder="Motif du geste commercial…"
          value={reason}
          onChange={(e) => onChange({ reason: e.target.value })}
        />
      </div>
    </div>
  );
}

function RefundsPage() {
  const refunds = useRefunds();
  const settings = useRefundSettings();
  const orders = useOrders();
  const tiers = useCommissionTiers();
  const [tab, setTab] = useState<RefundStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<RefundSource | "all">("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    orderRef: "",
    requester: "",
    amount: "",
    method: "Wave" as RefundMethod,
    reason: "",
  });
  const [noteId, setNoteId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [retryId, setRetryId] = useState<string | null>(null);
  const [retryMethod, setRetryMethod] = useState<RefundMethod>("Wave");

  const pending = refunds.filter((r) => r.status === "pending");
  const approved = refunds.filter((r) => r.status === "approved");
  const paid = refunds.filter((r) => r.status === "paid");
  const failed = refunds.filter((r) => r.status === "failed");
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const approvedTotal = approved.reduce((s, r) => s + r.amount, 0);
  const paidTotal = paid.reduce((s, r) => s + r.amount, 0);

  const decided = refunds.filter((r) => r.decidedAt);
  const avgHours =
    decided.length > 0
      ? decided.reduce(
          (s, r) => s + (new Date(r.decidedAt!).getTime() - new Date(r.createdAt).getTime()),
          0,
        ) /
        decided.length /
        3600_000
      : 0;

  // Ancrage sur la donnée réelle la plus récente (démo figée dans le passé)
  // plutôt que sur l'horloge système, pour détecter les dossiers vraiment
  // "en attente depuis longtemps" au sein du jeu de données.
  const refNow = Math.max(...refunds.map((r) => new Date(r.createdAt).getTime()));
  const longPending = pending.filter(
    (r) => refNow - new Date(r.createdAt).getTime() > LONG_PENDING_MS,
  );
  const urgentPending = pending.filter((r) => r.amount > settings.justificationThreshold);

  const sourceBreakdown = useMemo(() => {
    const bySource = new Map<RefundSource, number>();
    for (const r of refunds) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
    return Array.from(bySource.entries()).map(([source, count]) => ({ source, count }));
  }, [refunds]);

  const evolution = useMemo(() => {
    const paidOrApproved = refunds.filter((r) => r.status === "paid" || r.status === "approved");
    const byDay = new Map<string, number>();
    for (const r of paidOrApproved) {
      const day = new Date(r.createdAt).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + r.amount);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        amount,
      }));
  }, [refunds]);

  const list = refunds.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (
        !r.reference.toLowerCase().includes(q) &&
        !r.orderRef.toLowerCase().includes(q) &&
        !r.requester.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const exportCsv = () =>
    downloadCsv(
      "remboursements",
      ["Référence", "Origine", "Commande", "Bénéficiaire", "Montant", "Moyen", "Statut", "Date"],
      refunds.map((r) => [
        r.reference,
        REFUND_SOURCE_LABEL[r.source],
        r.orderRef,
        r.requester,
        r.amount,
        r.method,
        REFUND_STATUS_LABEL[r.status],
        new Date(r.createdAt).toLocaleDateString("fr-FR"),
      ]),
    );

  const submit = () => {
    if (!form.requester.trim() || !form.reason.trim() || !Number(form.amount)) {
      toast.error("Bénéficiaire, montant et motif sont obligatoires");
      return;
    }
    refundActions.create({
      source: "manual",
      orderRef: form.orderRef.trim() || "—",
      bornBy: "platform",
      requester: form.requester.trim(),
      amount: Number(form.amount),
      method: form.method,
      reason: form.reason.trim(),
    });
    auditActions.log("Geste commercial créé", form.requester.trim(), "info");
    setForm({ orderRef: "", requester: "", amount: "", method: "Wave", reason: "" });
    setShowForm(false);
    toast.success("Geste commercial créé");
  };

  const approve = (r: Refund) => {
    if (r.amount > settings.justificationThreshold && !note.trim()) {
      toast.error(
        `Une justification est obligatoire au-delà de ${formatFCFA(settings.justificationThreshold)}`,
      );
      return;
    }
    refundActions.approve(r.id, note || undefined);
    auditActions.log("Remboursement approuvé", r.reference, "info");
    setNoteId(null);
    setNote("");
    toast.success("Remboursement approuvé");
  };

  const reject = (r: Refund) => {
    if (!note.trim()) {
      toast.error("Indiquez un motif de rejet");
      return;
    }
    refundActions.reject(r.id, note);
    auditActions.log("Remboursement rejeté", r.reference, "warning");
    setNoteId(null);
    setNote("");
    toast.success("Remboursement rejeté");
  };

  const markPaid = (r: Refund) => {
    refundActions.markPaid(r.id);
    // Le producteur ne paie que quand l'argent part réellement, pas dès
    // l'approbation — c'est ce point précis qui touche ses revenus.
    if (r.bornBy === "farmer") {
      const order = orders.find((o) => o.reference === r.orderRef);
      if (order) {
        const volumeByFarmer = deliveredVolumeByFarmer(orders);
        const commission = commissionForAmount(order, tiers, volumeByFarmer, r.amount);
        transactionActions.recordRefundAdjustment({
          orderRef: order.reference,
          farmerId: order.farmerId,
          restaurantId: order.restaurantId,
          method: r.method === "Virement" ? "Wave" : r.method,
          amount: r.amount,
          reason: `Remboursement ${r.reference}`,
        });
        auditActions.log(
          `Revenus producteur ajustés (-${formatFCFA(r.amount - commission)})`,
          r.reference,
          "info",
        );
      }
    }
    auditActions.log("Remboursement exécuté", r.reference, "info");
    toast.success("Remboursement exécuté", {
      description: `${formatFCFA(r.amount)} via ${r.method}`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Remboursements"
        subtitle="Litiges, retours, incidents et gestes commerciaux — centre de résolution financière"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export comptable
            </Button>
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Gift className="h-4 w-4" />
              Nouveau geste commercial
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="À traiter"
          value={String(pending.length)}
          icon={TriangleAlert}
          hint={formatFCFA(pendingTotal)}
        />
        <StatCard
          label="En cours"
          value={String(approved.length)}
          icon={Clock}
          hint={formatFCFA(approvedTotal)}
        />
        <StatCard
          label="Remboursés"
          value={String(paid.length)}
          icon={Check}
          hint={formatFCFA(paidTotal)}
        />
        <StatCard
          label="Échecs"
          value={String(failed.length)}
          icon={X}
          hint={failed.length > 0 ? "À vérifier" : undefined}
        />
        <StatCard
          label="Délai moyen"
          value={avgHours > 0 ? `${avgHours.toFixed(1)} h` : "—"}
          icon={Wallet}
        />
      </div>

      {(urgentPending.length > 0 || failed.length > 0 || longPending.length > 0) && (
        <div className="glass rounded-2xl p-5 space-y-2.5">
          <h2 className="font-semibold flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" />À traiter maintenant
          </h2>
          {urgentPending.length > 0 && (
            <button
              onClick={() => setTab("pending")}
              className="flex w-full items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-left text-sm hover:bg-destructive/10"
            >
              <span>
                🔴 {urgentPending.length} remboursement(s) au-delà du seuil de justification (
                {formatFCFA(settings.justificationThreshold)})
              </span>
              <span className="font-semibold">
                {formatFCFA(urgentPending.reduce((s, r) => s + r.amount, 0))}
              </span>
            </button>
          )}
          {failed.length > 0 && (
            <button
              onClick={() => setTab("failed")}
              className="flex w-full items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-left text-sm hover:bg-red-500/10"
            >
              <span>🟠 {failed.length} remboursement(s) en échec</span>
            </button>
          )}
          {longPending.length > 0 && (
            <button
              onClick={() => setTab("pending")}
              className="flex w-full items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-sm hover:bg-amber-500/10"
            >
              <span>⚠ {longPending.length} dossier(s) en attente depuis plus de 24h</span>
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Répartition par origine</h2>
          <div className="h-48 mt-2">
            {refunds.length === 0 ? (
              <p className="h-full grid place-items-center text-sm text-muted-foreground">
                Aucun dossier.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceBreakdown}
                    dataKey="count"
                    nameKey="source"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {sourceBreakdown.map((s) => (
                      <Cell key={s.source} fill={SOURCE_COLOR[s.source]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p) => [
                      `${v} dossier(s)`,
                      REFUND_SOURCE_LABEL[p.payload.source as RefundSource],
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {sourceBreakdown.map((s) => (
              <li key={s.source} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SOURCE_COLOR[s.source] }}
                />
                {REFUND_SOURCE_LABEL[s.source]}
                <span className="ml-auto text-muted-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Évolution du montant remboursé</h2>
          <p className="text-xs text-muted-foreground">Dossiers approuvés ou payés, par jour</p>
          <div className="h-48 mt-2">
            {evolution.length === 0 ? (
              <p className="h-full grid place-items-center text-sm text-muted-foreground">
                Pas encore de dossier approuvé ou payé.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution}>
                  <defs>
                    <linearGradient id="refundFill" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="amount"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#refundFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Nouveau geste commercial</h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Les remboursements liés à un litige, un retour ou un incident sont créés directement
            depuis leur dossier d'origine — ce formulaire sert aux gestes commerciaux hors dossier.
          </p>
          <AmountForm
            requester={form.requester}
            orderRef={form.orderRef}
            amount={form.amount}
            method={form.method}
            reason={form.reason}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          />
          <div className="flex gap-2">
            <Button onClick={submit}>Créer</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une référence, une commande, un bénéficiaire…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={sourceFilter}
          onValueChange={(v) => setSourceFilter(v as RefundSource | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes origines</SelectItem>
            {(Object.keys(REFUND_SOURCE_LABEL) as RefundSource[]).map((s) => (
              <SelectItem key={s} value={s}>
                {REFUND_SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Aucun remboursement"
          description="Aucun dossier dans cette catégorie."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-52 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/admin/refunds/$refundId"
                      params={{ refundId: r.id }}
                      className="font-semibold hover:underline"
                    >
                      {r.reference}
                    </Link>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_CLASS[r.status],
                      )}
                    >
                      {REFUND_STATUS_LABEL[r.status]}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {REFUND_SOURCE_LABEL[r.source]}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {r.requester} · {r.orderRef} · {r.method} · {relativeTime(r.createdAt)} · Payé
                    par {REFUND_BORN_BY_LABEL[r.bornBy ?? "platform"]}
                  </div>
                  <p className="mt-1 text-sm">{r.reason}</p>
                  {r.note && <p className="mt-1 text-xs text-muted-foreground">Note : {r.note}</p>}
                  {r.status === "failed" && r.failureReason && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Échec : {r.failureReason} (tentative {r.attemptCount})
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Montant</div>
                  <div className="text-lg font-bold">{formatFCFA(r.amount)}</div>
                </div>
              </div>

              {r.status === "pending" &&
                (noteId === r.id ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    {r.amount > settings.justificationThreshold && (
                      <p className="text-xs text-destructive">
                        Justification obligatoire au-delà de{" "}
                        {formatFCFA(settings.justificationThreshold)}.
                      </p>
                    )}
                    <Textarea
                      placeholder="Note de décision"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="gap-2" onClick={() => approve(r)}>
                        <Check className="h-4 w-4" />
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => reject(r)}
                      >
                        <X className="h-4 w-4" />
                        Rejeter
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNoteId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNoteId(r.id);
                      setNote("");
                    }}
                  >
                    Traiter le dossier
                  </Button>
                ))}

              {r.status === "approved" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-2" onClick={() => markPaid(r)}>
                    <Banknote className="h-4 w-4" />
                    Marquer comme remboursé
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-destructive"
                    onClick={() => {
                      const reason = window.prompt("Motif de l'échec ?");
                      if (!reason) return;
                      refundActions.markFailed(r.id, reason);
                      auditActions.log("Remboursement en échec", r.reference, "warning");
                      toast.error("Remboursement marqué en échec");
                    }}
                  >
                    <X className="h-4 w-4" />
                    Marquer en échec
                  </Button>
                </div>
              )}

              {r.status === "failed" &&
                (retryId === r.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
                    <span className="text-xs text-muted-foreground">Nouveau moyen :</span>
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setRetryMethod(m)}
                        className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition ${retryMethod === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                      >
                        {m}
                      </button>
                    ))}
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        refundActions.retry(r.id, retryMethod);
                        auditActions.log(
                          "Nouvelle tentative de remboursement",
                          r.reference,
                          "info",
                        );
                        toast.success("Dossier repassé en cours");
                        setRetryId(null);
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Réessayer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRetryId(null)}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setRetryId(r.id);
                      setRetryMethod(r.method);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Réessayer / changer de moyen
                  </Button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
