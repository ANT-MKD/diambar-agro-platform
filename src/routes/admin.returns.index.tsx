import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageMinus, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  useReturns,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  type ReturnStatus,
} from "@/data/business";
import { useRefunds } from "@/data/finance";

export const Route = createFileRoute("/admin/returns/")({
  head: () => ({
    meta: [
      { title: "Retours — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Suivez les demandes de retour ouvertes par les restaurants auprès des producteurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReturns,
});

const STATUS_CLASS: Record<ReturnStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  refused: "bg-destructive/10 text-destructive border-destructive/20",
  credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

function AdminReturns() {
  const returns = useReturns();
  const refunds = useRefunds();

  const pending = returns.filter((r) => r.status === "pending");
  const accepted = returns.filter((r) => r.status === "accepted");
  const refused = returns.filter((r) => r.status === "refused");
  const credited = returns.filter((r) => r.status === "credited");
  const requestedTotal = pending.reduce((s, r) => s + r.requestedAmount, 0);

  const refundFor = (returnId: string) => refunds.find((r) => r.returnId === returnId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retours"
        subtitle="Demandes de retour ouvertes par les restaurants auprès des producteurs"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="À traiter"
          value={String(pending.length)}
          icon={PackageMinus}
          hint={formatFCFA(requestedTotal)}
        />
        <StatCard label="Acceptés" value={String(accepted.length)} icon={PackageMinus} />
        <StatCard label="Refusés" value={String(refused.length)} icon={PackageMinus} />
        <StatCard label="Avoirs émis" value={String(credited.length)} icon={PackageMinus} />
      </div>

      {returns.length === 0 ? (
        <EmptyState
          icon={PackageMinus}
          title="Aucun retour"
          description="Aucune demande de retour n'a été ouverte."
        />
      ) : (
        <div className="space-y-3">
          {returns.map((r) => {
            const refund = refundFor(r.id);
            return (
              <div key={r.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-52 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.reference}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[r.status]}`}
                      >
                        {RETURN_STATUS_LABEL[r.status]}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {RETURN_REASON_LABEL[r.reason]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {r.restaurantName} · {r.orderRef} · {r.productName} ({r.qty} {r.unit}) ·{" "}
                      {relativeTime(r.createdAt)}
                    </div>
                    <p className="mt-1 text-sm">{r.description}</p>
                    {r.decisionNote && (
                      <p className="mt-1 text-xs text-muted-foreground">Note : {r.decisionNote}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Montant demandé</div>
                    <div className="text-lg font-bold">{formatFCFA(r.requestedAmount)}</div>
                    {r.awardedAmount !== undefined && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Accordé : {formatFCFA(r.awardedAmount)}
                      </div>
                    )}
                  </div>
                </div>
                {refund && (
                  <Link
                    to="/admin/refunds/$refundId"
                    params={{ refundId: refund.id }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Voir le dossier de remboursement {refund.reference}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
