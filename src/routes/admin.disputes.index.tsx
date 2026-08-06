import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { DisputeStatusBadge, PriorityBadge, SlaBadge } from "@/components/disputes/dispute-badges";
import { formatFCFA, relativeTime } from "@/lib/format";
import { DISPUTE_CATEGORIES, PARTY_LABEL, disputeStats, useAllDisputes, useCreditNotes, type DisputeStatus } from "@/data/disputes";

export const Route = createFileRoute("/admin/disputes/")({
  head: () => ({ meta: [
    { title: "Litiges — Administration Diambar Agro" },
    { name: "description", content: "Centre de résolution : SLA, taux de litige par partie, montants remboursés." },
    { property: "og:title", content: "Litiges — Administration" },
    { property: "og:description", content: "Centre de résolution des litiges de la plateforme." },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminDisputes,
});

const TABS: { v: DisputeStatus | "all" | "overdue"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "overdue", label: "Hors délai" },
  { v: "open", label: "Ouverts" },
  { v: "investigating", label: "Instruction" },
  { v: "awaiting_response", label: "Réponse attendue" },
  { v: "resolved", label: "Résolus" },
  { v: "rejected", label: "Rejetés" },
];

function AdminDisputes() {
  const disputes = useAllDisputes();
  const credits = useCreditNotes();
  const [tab, setTab] = useState<DisputeStatus | "all" | "overdue">("all");
  const stats = useMemo(() => disputeStats(disputes), [disputes]);
  const rows = disputes.filter((d) => tab === "all" ? true : tab === "overdue" ? stats.overdue > 0 && d.status !== "resolved" && d.status !== "rejected" && new Date(d.slaDueAt).getTime() < Date.now() : d.status === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Litiges" subtitle={`${stats.open} dossier(s) en cours · ${stats.overdue} hors délai SLA`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Dossiers en cours", v: String(stats.open) },
          { l: "Délai moyen de résolution", v: stats.avgHours ? `${stats.avgHours.toFixed(0)} h` : "—" },
          { l: "Remboursé ce mois", v: formatFCFA(stats.refundedThisMonth) },
          { l: "Avoirs émis", v: `${credits.length} · ${formatFCFA(credits.reduce((s, c) => s + c.amount, 0))}` },
        ].map((k) => (
          <div key={k.l} className="glass rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
            <div className="mt-1 text-xl font-semibold">{k.v}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Taux de litige par partie mise en cause</h2>
        <div className="mt-3 space-y-2">
          {stats.byParty.map((p) => (
            <div key={`${p.role}-${p.name}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <span className="min-w-40 flex-1 font-medium">{p.name} <span className="text-[11px] text-muted-foreground">({PARTY_LABEL[p.role]})</span></span>
              <span className="text-muted-foreground">{p.count} litige(s)</span>
              <span className="text-muted-foreground">{p.liable} responsabilité(s) retenue(s)</span>
              <span className="font-medium">{formatFCFA(p.amount)}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${p.count >= 2 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border text-muted-foreground"}`}>
                Score {Math.max(0, 100 - p.count * 12 - p.liable * 8)}/100
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)} className={`h-9 rounded-xl px-3 text-sm font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{t.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((d) => (
          <Link key={d.id} to="/admin/disputes/$disputeId" params={{ disputeId: d.id }} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 transition hover:bg-accent/40">
            <div className="min-w-52 flex-1">
              <div className="font-semibold">{d.reference} · {DISPUTE_CATEGORIES[d.category]?.label} — {d.subcategory}</div>
              <div className="text-[11px] text-muted-foreground">{d.openedByName} vs {d.againstName} · commande {d.orderRef} · {d.assignee ?? "non assigné"} · {relativeTime(d.openedAt)}</div>
            </div>
            <SlaBadge dispute={d} />
            <PriorityBadge priority={d.priority} />
            <span className="font-medium">{formatFCFA(d.claimedAmount)}</span>
            <DisputeStatusBadge status={d.status} />
          </Link>
        ))}
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Aucun litige dans cet onglet.</div>}
      </div>
    </div>
  );
}
