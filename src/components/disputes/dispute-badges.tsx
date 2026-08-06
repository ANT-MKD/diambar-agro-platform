import { AlertTriangle, Clock } from "lucide-react";
import { STATUS_LABEL, slaRemaining, type Dispute, type DisputeStatus } from "@/data/disputes";

const TONE: Record<DisputeStatus, string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  investigating: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  awaiting_response: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function SlaBadge({ dispute }: { dispute: Dispute }) {
  if (dispute.status === "resolved" || dispute.status === "rejected") return null;
  const sla = slaRemaining(dispute);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${sla.overdue ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border text-muted-foreground"}`}>
      {sla.overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {sla.overdue ? sla.label : `Réponse sous ${sla.label}`}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Dispute["priority"] }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priority === "high" ? "border-destructive/20 bg-destructive/10 text-destructive" : priority === "medium" ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground"}`}>
      {priority === "high" ? "Priorité haute" : priority === "medium" ? "Priorité moyenne" : "Priorité basse"}
    </span>
  );
}
