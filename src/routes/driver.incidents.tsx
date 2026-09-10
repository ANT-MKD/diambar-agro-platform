import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TriangleAlert, Send, ArrowUpRight, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import {
  useIncidents, incidentActions, INCIDENT_TYPE_LABEL, INCIDENT_STATUS_LABEL,
  type IncidentType, type IncidentStatus,
} from "@/data/business";

export const Route = createFileRoute("/driver/incidents")({
  head: () => ({ meta: [
    { title: "Incidents de course — Espace livreur Diambar Agro" },
    { name: "description", content: "Signalez un client absent, un colis refusé ou une panne, et suivez vos indemnités de course." },
    { property: "og:title", content: "Incidents de course — Espace livreur" },
    { property: "og:description", content: "Signalement d'incidents de course et suivi des indemnités." },
    { name: "robots", content: "noindex" },
  ] }),
  component: IncidentsPage,
});

const TYPES = Object.keys(INCIDENT_TYPE_LABEL) as IncidentType[];

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

function IncidentsPage() {
  const incidents = useIncidents();
  const [form, setForm] = useState({ missionRef: "", type: "client_absent" as IncidentType, description: "", waitedMinutes: "", compensationRequested: "" });

  const open = incidents.filter((i) => i.status !== "resolved").length;
  const awarded = incidents.reduce((s, i) => s + (i.compensationAwarded ?? 0), 0);

  const submit = () => {
    if (!form.missionRef.trim() || !form.description.trim()) { toast.error("Mission et description sont obligatoires"); return; }
    incidentActions.create({
      missionRef: form.missionRef.trim(),
      type: form.type,
      description: form.description.trim(),
      waitedMinutes: Number(form.waitedMinutes) || 0,
      compensationRequested: Number(form.compensationRequested) || 0,
    });
    setForm({ missionRef: "", type: "client_absent", description: "", waitedMinutes: "", compensationRequested: "" });
    toast.success("Incident signalé au support");
  };

  const exportCsv = () =>
    downloadCsv("incidents-livreur", ["Référence", "Mission", "Type", "Attente (min)", "Demandé", "Accordé", "Statut"],
      incidents.map((i) => [i.reference, i.missionRef, INCIDENT_TYPE_LABEL[i.type], i.waitedMinutes, i.compensationRequested, i.compensationAwarded ?? 0, INCIDENT_STATUS_LABEL[i.status]]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents de course"
        subtitle="Client absent, colis refusé, panne — déclarez et suivez vos indemnités"
        actions={<Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Exporter</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Incidents en cours</div><div className="mt-1 text-2xl font-bold">{open}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Indemnités obtenues</div><div className="mt-1 text-2xl font-bold">{formatFCFA(awarded)}</div></div>
        <div className="glass rounded-2xl p-4"><div className="text-xs text-muted-foreground">Total déclarés</div><div className="mt-1 text-2xl font-bold">{incidents.length}</div></div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">Signaler un incident</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Référence mission</label>
            <Input placeholder="MIS-4210" value={form.missionRef} onChange={(e) => setForm({ ...form, missionRef: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Temps d'attente (min)</label>
            <Input inputMode="numeric" placeholder="30" value={form.waitedMinutes} onChange={(e) => setForm({ ...form, waitedMinutes: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Type d'incident</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                  {INCIDENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Indemnité demandée (FCFA)</label>
            <Input inputMode="numeric" placeholder="2000" value={form.compensationRequested} onChange={(e) => setForm({ ...form, compensationRequested: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea placeholder="Décrivez ce qui s'est passé sur place…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <Button className="gap-2" onClick={submit}><Send className="h-4 w-4" />Envoyer le signalement</Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Mes incidents</h3>
        {incidents.length === 0 ? (
          <EmptyState icon={TriangleAlert} title="Aucun incident" description="Vos signalements apparaîtront ici." />
        ) : incidents.map((i) => (
          <div key={i.id} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{i.reference}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[i.status]}`}>{INCIDENT_STATUS_LABEL[i.status]}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{i.missionRef} · {INCIDENT_TYPE_LABEL[i.type]} · attente {i.waitedMinutes} min · {relativeTime(i.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Demandé</div>
                <div className="font-bold">{formatFCFA(i.compensationRequested)}</div>
                {i.compensationAwarded !== undefined && <div className="text-xs text-emerald-600 dark:text-emerald-400">Accordé : {formatFCFA(i.compensationAwarded)}</div>}
              </div>
            </div>
            <p className="text-sm">{i.description}</p>
            <ul className="space-y-1 border-l-2 border-border pl-3">
              {i.history.map((h, idx) => (
                <li key={idx} className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{h.actor}</span> · {h.text} · {relativeTime(h.at)}</li>
              ))}
            </ul>
            {i.status === "open" && (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { incidentActions.escalate(i.id); toast.success("Incident escaladé au support"); }}>
                <ArrowUpRight className="h-4 w-4" />Escalader au support
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
