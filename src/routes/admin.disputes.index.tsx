import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { useDisputes } from "@/data/admin-store";

export const Route = createFileRoute("/admin/disputes/")({
  head: () => ({ meta: [{ title: "Litiges — Administration Diambar Agro" }, { name: "description", content: "Centre de résolution des litiges entre producteurs, restaurants et livreurs." }, { name: "robots", content: "noindex" }] }),
  component: AdminDisputes,
});

function AdminDisputes() {
  const disputes = useDisputes();
  const [tab, setTab] = useState<"all" | "open" | "investigating" | "resolved" | "rejected">("all");
  const rows = disputes.filter((d) => tab === "all" || d.status === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Litiges" subtitle={`${disputes.filter((d) => d.status === "open" || d.status === "investigating").length} dossier(s) en cours`} />
      <div className="glass rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
        {(["all", "open", "investigating", "resolved", "rejected"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 h-9 rounded-xl text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            {t === "all" ? "Tous" : t === "open" ? "Ouverts" : t === "investigating" ? "Instruction" : t === "resolved" ? "Résolus" : "Rejetés"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {rows.map((d) => (
          <Link key={d.id} to="/admin/disputes/$disputeId" params={{ disputeId: d.id }} className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3 hover:bg-accent/40 transition">
            <div className="flex-1 min-w-52">
              <div className="font-semibold">{d.reference} · {d.reason}</div>
              <div className="text-[11px] text-muted-foreground">{d.openedBy} vs {d.against} · commande {d.orderRef} · ouvert {relativeTime(d.openedAt)}</div>
            </div>
            <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${d.priority === "high" ? "border-destructive/20 bg-destructive/10 text-destructive" : d.priority === "medium" ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground"}`}>
              {d.priority === "high" ? "Priorité haute" : d.priority === "medium" ? "Priorité moyenne" : "Priorité basse"}
            </span>
            <span className="font-medium">{formatFCFA(d.amount)}</span>
            <AdminBadge value={d.status} />
          </Link>
        ))}
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Aucun litige dans cet onglet.</div>}
      </div>
    </div>
  );
}
