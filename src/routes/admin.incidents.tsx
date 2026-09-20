import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TriangleAlert, Check, X, Clock, Wallet, ArrowUpRight, Truck } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, relativeTime } from "@/lib/format";
import { auditActions } from "@/data/admin-store";
import {
  useIncidents,
  incidentActions,
  INCIDENT_TYPE_LABEL,
  INCIDENT_STATUS_LABEL,
  type IncidentStatus,
  type Incident,
} from "@/data/business";
import { useMissions } from "@/data/store";
import { drivers } from "@/data/mocks";

export const Route = createFileRoute("/admin/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents de course — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Traitez les incidents signalés par les livreurs et statuez sur les indemnités demandées.",
      },
      { property: "og:title", content: "Incidents de course — Administration" },
      {
        property: "og:description",
        content: "File de traitement des incidents de course de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminIncidents,
});

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const TABS: { v: IncidentStatus | "all"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "escalated", label: "Escaladés" },
  { v: "open", label: "Ouverts" },
  { v: "resolved", label: "Résolus" },
];

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function AdminIncidents() {
  const incidents = useIncidents();
  const missions = useMissions();
  const [tab, setTab] = useState<IncidentStatus | "all">("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const pending = incidents.filter((i) => i.status !== "resolved");
  const escalated = incidents.filter((i) => i.status === "escalated");
  const resolvedThisMonth = incidents.filter(
    (i) => i.status === "resolved" && isThisMonth(i.createdAt),
  );
  const compensatedThisMonth = resolvedThisMonth.reduce(
    (s, i) => s + (i.compensationAwarded ?? 0),
    0,
  );
  const awardedCount = incidents.filter((i) => (i.compensationAwarded ?? 0) > 0).length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  const rows = incidents.filter((i) => (tab === "all" ? true : i.status === tab));

  const driverFor = (missionRef: string) => {
    const mission = missions.find((m) => m.reference === missionRef);
    return mission ? drivers.find((d) => d.id === mission.driverId) : undefined;
  };

  const startAction = (i: Incident) => {
    setActingId(i.id);
    setAmount(String(i.compensationRequested));
    setNote("");
  };

  const cancelAction = () => {
    setActingId(null);
    setAmount("");
    setNote("");
  };

  const award = (i: Incident) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Indiquez un montant valide");
      return;
    }
    incidentActions.resolve(i.id, value, note.trim() || undefined);
    auditActions.log(
      value > 0 ? `Incident indemnisé (${formatFCFA(value)})` : "Incident clôturé sans indemnité",
      i.reference,
      "info",
    );
    toast.success(
      value > 0 ? `Indemnité de ${formatFCFA(value)} versée au livreur` : "Incident clôturé",
    );
    cancelAction();
  };

  const reject = (i: Incident) => {
    incidentActions.resolve(i.id, 0, note.trim() || "Demande jugée non fondée");
    auditActions.log("Indemnité refusée", i.reference, "warning");
    toast.success("Demande d'indemnité refusée");
    cancelAction();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents de course"
        subtitle={`${pending.length} incident(s) en attente · ${escalated.length} escaladé(s) au support`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="À traiter" value={String(pending.length)} icon={TriangleAlert} />
        <StatCard
          label="Escaladés"
          value={String(escalated.length)}
          icon={ArrowUpRight}
          hint="Nécessitent une décision"
        />
        <StatCard
          label="Indemnisé ce mois"
          value={formatFCFA(compensatedThisMonth)}
          icon={Wallet}
        />
        <StatCard
          label="Dossiers traités"
          value={`${resolvedCount}/${incidents.length}`}
          icon={Check}
          hint={`${awardedCount} indemnité(s) accordée(s)`}
        />
      </div>

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

      {rows.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="Aucun incident"
          description="Aucun incident dans cette catégorie."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((i) => {
            const driver = driverFor(i.missionRef);
            return (
              <div key={i.id} className="glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-52 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{i.reference}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[i.status]}`}
                      >
                        {INCIDENT_STATUS_LABEL[i.status]}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {INCIDENT_TYPE_LABEL[i.type]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      {i.missionRef} · {driver?.name ?? "livreur inconnu"} ·{" "}
                      {relativeTime(i.createdAt)}
                    </div>
                    <p className="mt-2 text-sm">{i.description}</p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Attente : {i.waitedMinutes} min
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Indemnité demandée</div>
                    <div className="text-lg font-bold">{formatFCFA(i.compensationRequested)}</div>
                    {i.status === "resolved" && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Accordé : {formatFCFA(i.compensationAwarded ?? 0)}
                      </div>
                    )}
                  </div>
                </div>

                {i.status !== "resolved" &&
                  (actingId === i.id ? (
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Montant à accorder (FCFA)
                        </label>
                        <Input
                          inputMode="numeric"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="Note de décision (visible par le livreur)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="gap-2" onClick={() => award(i)}>
                          <Check className="h-4 w-4" />
                          Accorder l'indemnité
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => reject(i)}
                        >
                          <X className="h-4 w-4" />
                          Refuser
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelAction}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startAction(i)}>
                      Traiter le dossier
                    </Button>
                  ))}

                {i.status === "resolved" && i.resolutionNote && (
                  <p className="text-xs text-muted-foreground">Note : {i.resolutionNote}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
