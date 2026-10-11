import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Scale, Search, Download } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { DataState } from "@/components/common/data-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { DisputeStatusBadge, PriorityBadge, SlaBadge } from "./dispute-badges";
import {
  DISPUTE_CATEGORIES,
  PARTY_LABEL,
  STATUS_LABEL,
  disputeStats,
  type Dispute,
  type DisputeParty,
  type DisputeStatus,
} from "@/data/disputes";

const TABS: { v: DisputeStatus | "all"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "open", label: "Ouverts" },
  { v: "investigating", label: "Instruction" },
  { v: "awaiting_response", label: "Réponse attendue" },
  { v: "resolved", label: "Résolus" },
  { v: "rejected", label: "Rejetés" },
];

const PERIODS: { v: "7" | "30" | "90" | "all"; label: string }[] = [
  { v: "7", label: "7 derniers jours" },
  { v: "30", label: "30 derniers jours" },
  { v: "90", label: "90 derniers jours" },
  { v: "all", label: "Toute la période" },
];

const SORTS: { v: "recent" | "oldest" | "amount"; label: string }[] = [
  { v: "recent", label: "Plus récents" },
  { v: "oldest", label: "Plus anciens" },
  { v: "amount", label: "Montant réclamé" },
];

function pctDelta(curr: number, prev: number) {
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
}

export function DisputeListView({
  disputes,
  role,
  detailPath,
  title = "Mes litiges",
  subtitle,
  actions,
}: {
  disputes: Dispute[];
  role: DisputeParty;
  detailPath: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [tab, setTab] = useState<DisputeStatus | "all">("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | string>("all");
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "amount">("recent");
  const stats = useMemo(() => disputeStats(disputes), [disputes]);
  const amountDelta = pctDelta(stats.claimedThisMonth, stats.claimedLastMonth);

  const rows = useMemo(() => {
    const periodCutoff =
      period === "all" ? null : new Date(Date.now() - Number(period) * 24 * 3600_000);
    let list = disputes.filter(
      (d) =>
        (tab === "all" || d.status === tab) &&
        (category === "all" || d.category === category) &&
        (!periodCutoff || new Date(d.openedAt) >= periodCutoff) &&
        (q.trim() === "" ||
          `${d.reference} ${d.orderRef} ${d.subcategory} ${d.openedByName} ${d.againstName}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
    list = [...list];
    if (sort === "recent") list.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    else if (sort === "oldest") list.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    else list.sort((a, b) => b.claimedAmount - a.claimedAmount);
    return list;
  }, [disputes, tab, category, period, q, sort]);

  const exportCsv = () =>
    downloadCsv(
      "litiges",
      [
        "Référence",
        "Type",
        "Sous-catégorie",
        "Commande",
        "Montant réclamé",
        "Montant accordé",
        "Statut",
      ],
      disputes.map((d) => [
        d.reference,
        DISPUTE_CATEGORIES[d.category]?.label ?? d.category,
        d.subcategory,
        d.orderRef,
        d.claimedAmount,
        d.grantedAmount ?? 0,
        STATUS_LABEL[d.status],
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle ?? `${stats.open} dossier(s) en cours · ${stats.overdue} hors délai`}
        actions={actions}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            l: "Litiges ouverts",
            v: String(stats.openStrict),
            delta: stats.openedThisWeek > 0 ? `+${stats.openedThisWeek} cette semaine` : null,
          },
          {
            l: "En traitement",
            v: String(stats.inTreatment),
            delta: stats.overdue > 0 ? `${stats.overdue} hors délai` : null,
          },
          {
            l: "Résolus",
            v: String(stats.resolvedCount),
            delta:
              stats.resolvedThisMonthCount > 0 ? `+${stats.resolvedThisMonthCount} ce mois` : null,
          },
          {
            l: "Montants concernés",
            v: formatFCFA(stats.claimedTotal),
            delta:
              amountDelta !== null ? `${amountDelta >= 0 ? "+" : ""}${amountDelta}% ce mois` : null,
          },
        ].map((k) => (
          <div key={k.l} className="glass rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
            <div className="mt-1 text-xl font-semibold">{k.v}</div>
            {k.delta && <div className="mt-0.5 text-[11px] text-muted-foreground">{k.delta}</div>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`h-9 rounded-xl px-3 text-sm font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Référence, commande, partie…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {Object.entries(DISPUTE_CATEGORIES).map(([k, c]) => (
              <SelectItem key={k} value={k}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.v} value={p.v}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.v} value={s.v}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-2" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Exporter CSV
        </Button>
      </div>

      <DataState
        empty={rows.length === 0}
        emptyIcon={<Scale className="h-7 w-7" />}
        emptyTitle="Aucun litige"
        emptyDescription="Aucun dossier ne correspond à ce filtre. Ouvrez un litige depuis le détail d'une commande."
      >
        <div className="space-y-3">
          {rows.map((d) => {
            const mine = d.openedByRole === role;
            return (
              <Link
                key={d.id}
                to={detailPath as never}
                params={{ disputeId: d.id } as never}
                className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 transition hover:bg-accent/40"
              >
                <div className="min-w-52 flex-1">
                  <div className="font-semibold">
                    {d.reference} · {DISPUTE_CATEGORIES[d.category]?.label ?? d.category} —{" "}
                    {d.subcategory}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {mine
                      ? `Contre ${PARTY_LABEL[d.againstRole]} · ${d.againstName}`
                      : `Ouvert par ${d.openedByName} (${PARTY_LABEL[d.openedByRole]})`}{" "}
                    · commande {d.orderRef} · {relativeTime(d.openedAt)}
                  </div>
                </div>
                {!mine && (
                  <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Vous êtes mis en cause
                  </span>
                )}
                <SlaBadge dispute={d} />
                <PriorityBadge priority={d.priority} />
                <div className="text-right">
                  <div className="font-medium">{formatFCFA(d.claimedAmount)}</div>
                  {d.grantedAmount !== null && (
                    <div className="text-[11px] text-muted-foreground">
                      accordé {formatFCFA(d.grantedAmount)}
                    </div>
                  )}
                </div>
                <DisputeStatusBadge status={d.status} />
              </Link>
            );
          })}
        </div>
      </DataState>
    </div>
  );
}
