import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Scale, Search } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { DataState } from "@/components/common/data-state";
import { Input } from "@/components/ui/input";
import { formatFCFA, relativeTime } from "@/lib/format";
import { DisputeStatusBadge, PriorityBadge, SlaBadge } from "./dispute-badges";
import { DISPUTE_CATEGORIES, PARTY_LABEL, disputeStats, type Dispute, type DisputeParty, type DisputeStatus } from "@/data/disputes";

const TABS: { v: DisputeStatus | "all"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "open", label: "Ouverts" },
  { v: "investigating", label: "Instruction" },
  { v: "awaiting_response", label: "Réponse attendue" },
  { v: "resolved", label: "Résolus" },
  { v: "rejected", label: "Rejetés" },
];

export function DisputeListView({
  disputes, role, detailPath, title = "Mes litiges", subtitle, actions,
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
  const stats = useMemo(() => disputeStats(disputes), [disputes]);

  const rows = disputes.filter((d) =>
    (tab === "all" || d.status === tab) &&
    (q.trim() === "" || `${d.reference} ${d.orderRef} ${d.subcategory} ${d.openedByName} ${d.againstName}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle ?? `${stats.open} dossier(s) en cours · ${stats.overdue} hors délai`} actions={actions} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Dossiers en cours", v: String(stats.open) },
          { l: "Hors délai SLA", v: String(stats.overdue) },
          { l: "Montant en jeu", v: formatFCFA(stats.claimedTotal) },
          { l: "Délai moyen de résolution", v: stats.avgHours ? `${stats.avgHours.toFixed(0)} h` : "—" },
        ].map((k) => (
          <div key={k.l} className="glass rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
            <div className="mt-1 text-xl font-semibold">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
          {TABS.map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} className={`h-9 rounded-xl px-3 text-sm font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence, commande, partie…" className="pl-9" />
        </div>
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
              <Link key={d.id} to={detailPath as never} params={{ disputeId: d.id } as never} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 transition hover:bg-accent/40">
                <div className="min-w-52 flex-1">
                  <div className="font-semibold">{d.reference} · {DISPUTE_CATEGORIES[d.category]?.label ?? d.category} — {d.subcategory}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {mine ? `Contre ${PARTY_LABEL[d.againstRole]} · ${d.againstName}` : `Ouvert par ${d.openedByName} (${PARTY_LABEL[d.openedByRole]})`} · commande {d.orderRef} · {relativeTime(d.openedAt)}
                  </div>
                </div>
                {!mine && <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Vous êtes mis en cause</span>}
                <SlaBadge dispute={d} />
                <PriorityBadge priority={d.priority} />
                <div className="text-right">
                  <div className="font-medium">{formatFCFA(d.claimedAmount)}</div>
                  {d.grantedAmount !== null && <div className="text-[11px] text-muted-foreground">accordé {formatFCFA(d.grantedAmount)}</div>}
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
