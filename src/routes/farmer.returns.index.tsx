import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw, Download, ClipboardList, Clock, CheckCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { KpiCard } from "@/components/farmer/kpi-card";
import { Button } from "@/components/ui/button";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import {
  useReturns,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  type ReturnStatus,
} from "@/data/business";

export const Route = createFileRoute("/farmer/returns/")({
  head: () => ({
    meta: [
      { title: "Retours & avoirs — Espace agriculteur Diambar Agro" },
      {
        name: "description",
        content:
          "Traitez les demandes de retour de vos clients restaurants : acceptation, refus motivé et émission d'avoirs.",
      },
      { property: "og:title", content: "Retours & avoirs — Espace agriculteur" },
      {
        property: "og:description",
        content: "Traitement des retours produits et émission d'avoirs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnsPage,
});

const TABS: { key: ReturnStatus | "all"; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "À traiter" },
  { key: "accepted", label: "Acceptés" },
  { key: "credited", label: "Avoirs émis" },
  { key: "refused", label: "Refusés" },
];

const STATUS_CLASS: Record<ReturnStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  refused: "bg-destructive/10 text-destructive border-destructive/20",
};

function ReturnsPage() {
  const returns = useReturns();
  const [tab, setTab] = useState<ReturnStatus | "all">("all");
  const list = tab === "all" ? returns : returns.filter((r) => r.status === tab);
  const pending = returns.filter((r) => r.status === "pending").length;
  const processed = returns.filter((r) => r.status !== "pending").length;
  const credited = returns.filter((r) => r.status === "credited");
  const totalCredited = credited.reduce((s, r) => s + (r.awardedAmount ?? 0), 0);

  const exportCsv = () =>
    downloadCsv(
      "retours-avoirs",
      [
        "Référence",
        "Commande",
        "Client",
        "Produit",
        "Qté",
        "Motif",
        "Demandé",
        "Accordé",
        "Statut",
      ],
      returns.map((r) => [
        r.reference,
        r.orderRef,
        r.restaurantName,
        r.productName,
        `${r.qty} ${r.unit}`,
        RETURN_REASON_LABEL[r.reason],
        r.requestedAmount,
        r.awardedAmount ?? 0,
        RETURN_STATUS_LABEL[r.status],
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retours & avoirs"
        subtitle="Demandes de retour de vos clients et avoirs émis"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          label="Demandes de retour"
          value={String(returns.length)}
          tone="blue"
        />
        <KpiCard icon={Clock} label="En attente" value={String(pending)} tone="amber" />
        <KpiCard
          icon={CheckCheck}
          label="Retours traités"
          value={String(processed)}
          tone="violet"
        />
        <KpiCard
          icon={Wallet}
          label="Avoirs émis"
          value={String(credited.length)}
          change={formatFCFA(totalCredited)}
          tone="emerald"
        />
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
          icon={RotateCcw}
          title="Aucun retour"
          description="Aucune demande de retour dans cette catégorie."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <Link
              key={r.id}
              to="/farmer/returns/$returnId"
              params={{ returnId: r.id }}
              className="block glass rounded-2xl p-4 hover:bg-accent/40 transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.reference}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[r.status]}`}
                    >
                      {RETURN_STATUS_LABEL[r.status]}
                    </span>
                    {r.status === "pending" && (
                      <span className="text-[10px] font-semibold text-primary">À traiter →</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {r.restaurantName} · {r.orderRef} · {r.productName} ({r.qty} {r.unit})
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {RETURN_REASON_LABEL[r.reason]} · {relativeTime(r.createdAt)}
                    {r.messages.length > 0 ? ` · ${r.messages.length} message(s)` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Montant réclamé</div>
                  <div className="font-bold">{formatFCFA(r.requestedAmount)}</div>
                  {r.awardedAmount !== undefined && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      Accordé : {formatFCFA(r.awardedAmount)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
