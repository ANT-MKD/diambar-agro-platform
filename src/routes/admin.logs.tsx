import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { relativeTime } from "@/lib/format";
import { useAuditLogs } from "@/data/admin-store";

export const Route = createFileRoute("/admin/logs")({
  head: () => ({ meta: [{ title: "Journal d'audit — Administration Diambar Agro" }, { name: "description", content: "Traçabilité complète des actions administratives et système." }, { name: "robots", content: "noindex" }] }),
  component: AdminLogs,
});

function AdminLogs() {
  const logs = useAuditLogs();
  const [level, setLevel] = useState<"all" | "info" | "warning" | "critical">("all");
  const rows = logs.filter((l) => level === "all" || l.level === level);

  return (
    <div className="space-y-6">
      <PageHeader title="Journal d'audit" subtitle={`${logs.length} événements enregistrés`} />
      <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
        {(["all", "info", "warning", "critical"] as const).map((l) => (
          <button key={l} onClick={() => setLevel(l)} className={`px-3 h-9 rounded-xl text-sm font-medium transition ${level === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            {l === "all" ? "Tout" : l === "info" ? "Info" : l === "warning" ? "Alerte" : "Critique"}
          </button>
        ))}
      </div>
      <div className="glass rounded-2xl divide-y divide-border">
        {rows.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className={`h-2 w-2 rounded-full shrink-0 ${l.level === "critical" ? "bg-destructive" : l.level === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{l.action}</div>
              <div className="text-[11px] text-muted-foreground truncate">{l.target} · par {l.actor}</div>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{relativeTime(l.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
