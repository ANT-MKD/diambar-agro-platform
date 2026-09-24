import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  TriangleAlert,
  Send,
  ArrowUpRight,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  Siren,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileDrop } from "@/components/disputes/file-drop";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { formatFCFA, relativeTime } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import {
  useIncidents,
  incidentActions,
  INCIDENT_TYPE_LABEL,
  INCIDENT_STATUS_LABEL,
  type IncidentType,
  type IncidentStatus,
} from "@/data/business";
import { useMissions } from "@/data/store";
import { supportTicketActions } from "@/data/support";
import type { DisputeAttachment } from "@/data/disputes";
import { EMERGENCY_NUMBERS, sendSos, SUPPORT_HOTLINE } from "@/lib/sos";

export const Route = createFileRoute("/driver/incidents/")({
  validateSearch: z.object({ missionRef: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Incidents & assistance — Espace livreur Diambar Agro" },
      {
        name: "description",
        content:
          "Signalez un client absent, un colis refusé ou une panne, et suivez vos indemnités de course.",
      },
      { property: "og:title", content: "Incidents & assistance — Espace livreur" },
      {
        property: "og:description",
        content: "Signalement d'incidents de course et suivi des indemnités.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IncidentsPage,
});

const PRIMARY_TYPES: IncidentType[] = ["client_absent", "refused", "breakdown", "address"];
const OTHER_TYPES: IncidentType[] = ["traffic", "accident", "other"];

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const PAGE_SIZE = 6;

function IncidentsPage() {
  const { missionRef: prefillMissionRef } = Route.useSearch();
  const incidents = useIncidents();
  const missions = useMissions();

  const recentMissions = useMemo(
    () =>
      missions
        .filter((m) => m.driverId === "d1")
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
        .slice(0, 15),
    [missions],
  );

  const [showOther, setShowOther] = useState(false);
  const [form, setForm] = useState({
    missionRef: prefillMissionRef ?? "",
    type: "client_absent" as IncidentType,
    description: "",
    waitedMinutes: "",
    compensationRequested: "",
  });
  const [photos, setPhotos] = useState<DisputeAttachment[]>([]);

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | IncidentStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | IncidentType>("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "amount">("recent");
  const [page, setPage] = useState(1);

  const [supportOpen, setSupportOpen] = useState(false);

  const openCount = incidents.filter((i) => i.status === "open").length;
  const inTreatment = incidents.filter((i) => i.status === "escalated").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;
  const awardedTotal = incidents.reduce((s, i) => s + (i.compensationAwarded ?? 0), 0);

  const submit = () => {
    if (!form.missionRef.trim() || !form.description.trim()) {
      toast.error("Mission et description sont obligatoires");
      return;
    }
    const item = incidentActions.create({
      missionRef: form.missionRef.trim(),
      type: form.type,
      description: form.description.trim(),
      waitedMinutes: Number(form.waitedMinutes) || 0,
      compensationRequested: Number(form.compensationRequested) || 0,
      photos,
    });
    setForm({
      missionRef: "",
      type: "client_absent",
      description: "",
      waitedMinutes: "",
      compensationRequested: "",
    });
    setPhotos([]);
    toast.success(`Incident ${item.reference} signalé au support`);
  };

  const sendUrgentTicket = async () => {
    const id = await sendSos({ fromName: "Oumar Ba", missionRef: form.missionRef || undefined });
    toast.success(`Alerte ${id.toUpperCase()} envoyée — l'équipe vous rappelle immédiatement`, {
      description: `Si vous êtes en danger : police ${EMERGENCY_NUMBERS.police}, pompiers ${EMERGENCY_NUMBERS.pompiers}.`,
    });
    window.location.href = `tel:${SUPPORT_HOTLINE.replace(/\s/g, "")}`;
  };

  const filtered = useMemo(() => {
    let list = incidents;
    if (statusTab !== "all") list = list.filter((i) => i.status === statusTab);
    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.reference.toLowerCase().includes(q) ||
          i.missionRef.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sort === "recent") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (sort === "oldest") sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    else sorted.sort((a, b) => (b.compensationAwarded ?? 0) - (a.compensationAwarded ?? 0));
    return sorted;
  }, [incidents, statusTab, typeFilter, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () =>
    downloadCsv(
      "incidents-livreur",
      ["Référence", "Mission", "Type", "Attente (min)", "Demandé", "Accordé", "Statut"],
      incidents.map((i) => [
        i.reference,
        i.missionRef,
        INCIDENT_TYPE_LABEL[i.type],
        i.waitedMinutes,
        i.compensationRequested,
        i.compensationAwarded ?? 0,
        INCIDENT_STATUS_LABEL[i.status],
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents & assistance"
        subtitle="Signalez un problème pendant une course et suivez sa résolution"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={sendUrgentTicket}
            >
              <Siren className="h-4 w-4" />
              Situation urgente
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setSupportOpen(true)}>
              <LifeBuoy className="h-4 w-4" />
              Contacter le support
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Incidents ouverts</div>
          <div className="mt-1 text-2xl font-bold">{openCount}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">En traitement</div>
          <div className="mt-1 text-2xl font-bold">{inTreatment}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Résolus</div>
          <div className="mt-1 text-2xl font-bold">{resolvedCount}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Indemnités obtenues</div>
          <div className="mt-1 text-2xl font-bold text-primary">{formatFCFA(awardedTotal)}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">Signalement rapide</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mission concernée</label>
            <Select
              value={form.missionRef}
              onValueChange={(v) => setForm({ ...form, missionRef: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir une mission récente" />
              </SelectTrigger>
              <SelectContent>
                {recentMissions.map((m) => (
                  <SelectItem key={m.id} value={m.reference}>
                    {m.reference} · {m.scheduledFor.slice(0, 10)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Temps d'attente (min)
            </label>
            <Input
              inputMode="numeric"
              placeholder="30"
              value={form.waitedMinutes}
              onChange={(e) => setForm({ ...form, waitedMinutes: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Type d'incident</label>
            <div className="flex flex-wrap gap-2">
              {PRIMARY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                >
                  {INCIDENT_TYPE_LABEL[t]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowOther((v) => !v)}
                className="flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Autres problèmes
                <ChevronDown
                  className={`h-3.5 w-3.5 transition ${showOther ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {showOther && (
              <div className="flex flex-wrap gap-2 pt-1">
                {OTHER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    {INCIDENT_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Indemnité demandée (FCFA)
            </label>
            <Input
              inputMode="numeric"
              placeholder="2000"
              value={form.compensationRequested}
              onChange={(e) => setForm({ ...form, compensationRequested: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              placeholder="Décrivez ce qui s'est passé sur place…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <FileDrop
              value={photos}
              onChange={setPhotos}
              by="Oumar Ba"
              kind="photo"
              label="Preuves (photos)"
              accept="image/*"
              max={4}
            />
          </div>
        </div>
        <Button className="gap-2" onClick={submit}>
          <Send className="h-4 w-4" />
          Envoyer le signalement
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Mes incidents</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-40 pl-8 sm:w-52"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as typeof typeFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {[...PRIMARY_TYPES, ...OTHER_TYPES].map((t) => (
                  <SelectItem key={t} value={t}>
                    {INCIDENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Trier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="oldest">Plus anciens</SelectItem>
                <SelectItem value="amount">Indemnité accordée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs
          value={statusTab}
          onValueChange={(v) => {
            setStatusTab(v as typeof statusTab);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="open">Ouverts</TabsTrigger>
            <TabsTrigger value="escalated">En traitement</TabsTrigger>
            <TabsTrigger value="resolved">Résolus</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="Aucun incident"
            description="Vos signalements apparaîtront ici."
          />
        ) : (
          <>
            <div className="space-y-3">
              {pageItems.map((i) => (
                <Link
                  key={i.id}
                  to="/driver/incidents/$incidentId"
                  params={{ incidentId: i.id }}
                  className="block glass rounded-2xl p-4 space-y-3 transition hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{i.reference}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[i.status]}`}
                        >
                          {INCIDENT_STATUS_LABEL[i.status]}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {i.missionRef} · {INCIDENT_TYPE_LABEL[i.type]} · attente {i.waitedMinutes}{" "}
                        min · {relativeTime(i.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Demandé</div>
                      <div className="font-bold">{formatFCFA(i.compensationRequested)}</div>
                      {i.compensationAwarded !== undefined && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          Accordé : {formatFCFA(i.compensationAwarded)}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm line-clamp-2">{i.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Voir le détail
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Affichage de {(page - 1) * PAGE_SIZE + 1} à{" "}
                  {Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} incidents
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8 w-8 rounded-lg border border-border grid place-items-center disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold ${p === page ? "bg-primary text-primary-foreground" : "border border-border"}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                    className="h-8 w-8 rounded-lg border border-border grid place-items-center disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Contacter le support</DialogTitle>
            <DialogDescription>
              Votre message crée un ticket réel suivi par l'équipe support Diambar.
            </DialogDescription>
          </DialogHeader>
          <SupportTicketForm
            role="driver"
            fromName="Oumar Ba"
            onCreated={() => setSupportOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
