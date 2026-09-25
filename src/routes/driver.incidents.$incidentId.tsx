import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Truck,
  TriangleAlert,
  Wallet,
  Clock,
  MapPin,
  ArrowUpRight,
  LifeBuoy,
  MessageSquare,
  ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  useIncidents,
  incidentActions,
  INCIDENT_TYPE_LABEL,
  INCIDENT_STATUS_LABEL,
  type IncidentStatus,
} from "@/data/business";
import { useMissions, useDriverWallet } from "@/data/store";
import { restaurants, farmers } from "@/data/mocks";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";

export const Route = createFileRoute("/driver/incidents/$incidentId")({
  head: () => ({
    meta: [
      { title: "Détail incident — Espace livreur Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => ({ incidentId: params.incidentId }),
  component: IncidentDetail,
});

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

function IncidentDetail() {
  const { incidentId } = Route.useLoaderData();
  const incidents = useIncidents();
  const missions = useMissions();
  const wallet = useDriverWallet();

  const incident = incidents.find((i) => i.id === incidentId);
  const [comment, setComment] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);

  if (!incident) {
    throw notFound();
  }

  const mission = missions.find((m) => m.reference === incident.missionRef);
  const restaurant = mission ? restaurants.find((r) => r.id === mission.restaurantId) : undefined;
  const farmer = mission ? farmers.find((f) => f.id === mission.farmerId) : undefined;
  const walletTx = wallet.transactions.find((t) => t.ref === incident.reference);

  const statut =
    incident.status !== "resolved"
      ? "En attente"
      : (incident.compensationAwarded ?? 0) > 0
        ? "Accordée"
        : "Refusée";

  const addComment = () => {
    if (!comment.trim()) return;
    incidentActions.addComment(incident.id, comment.trim());
    setComment("");
    toast.success("Commentaire ajouté");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={incident.reference}
        subtitle={`Signalé ${relativeTime(incident.createdAt)}`}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/driver/incidents">
              <ArrowLeft className="h-4 w-4" />
              Incidents
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASS[incident.status]}`}
        >
          {INCIDENT_STATUS_LABEL[incident.status]}
        </span>
        {incident.status === "open" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              incidentActions.escalate(incident.id);
              toast.success("Incident escaladé au support");
            }}
          >
            <ArrowUpRight className="h-4 w-4" />
            Escalader au support
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatPill icon={Truck} label="Mission" value={incident.missionRef} />
        <StatPill icon={TriangleAlert} label="Type" value={INCIDENT_TYPE_LABEL[incident.type]} />
        <StatPill
          icon={Wallet}
          label="Indemnité demandée"
          value={formatFCFA(incident.compensationRequested)}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-display font-bold">Détail de l'incident</h3>
            <p className="text-sm">{incident.description}</p>
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Temps d'attente :{" "}
                <span className="font-medium text-foreground">{incident.waitedMinutes} min</span>
              </div>
              {mission && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  Adresse :{" "}
                  <span className="font-medium text-foreground">{mission.dropoff.address}</span>
                </div>
              )}
            </div>
          </div>

          {incident.photos && incident.photos.length > 0 && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold">Preuves jointes ({incident.photos.length})</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {incident.photos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border overflow-hidden">
                    {p.dataUrl && p.mime.startsWith("image/") ? (
                      <img src={p.dataUrl} alt={p.name} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="h-28 w-full grid place-items-center bg-muted text-muted-foreground">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="p-2 text-[11px] truncate text-muted-foreground">{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold">Historique de l'incident</h3>
            <ol className="space-y-4 border-l-2 border-border pl-4">
              {incident.history.map((h, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{h.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.actor} · {relativeTime(h.at)}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 space-y-2.5">
            <h3 className="font-display font-bold">Indemnisation</h3>
            <Row label="Montant demandé" value={formatFCFA(incident.compensationRequested)} />
            <Row
              label="Montant accordé"
              value={
                incident.compensationAwarded !== undefined
                  ? formatFCFA(incident.compensationAwarded)
                  : "—"
              }
            />
            <Row label="Statut" value={statut} />
            {walletTx && (
              <Link
                to="/driver/wallet"
                className="flex items-center gap-1.5 pt-1 text-xs font-medium text-primary hover:underline"
              >
                Voir le versement dans mon portefeuille
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {statut === "Refusée" && incident.resolutionNote && (
              <p className="pt-1 text-xs text-muted-foreground">
                Motif : {incident.resolutionNote}
              </p>
            )}
          </div>

          {mission && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold">Mission associée</h3>
              <div className="text-sm">
                {farmer?.farm} → {restaurant?.name}
              </div>
              <div className="text-xs text-muted-foreground">{mission.dropoff.address}</div>
              <DiambarMapLazy
                markers={[
                  { id: "dropoff", lat: mission.dropoff.lat, lng: mission.dropoff.lng, label: "1" },
                ]}
                minHeight={140}
                zoom={13}
              />
              <Button asChild size="sm" variant="outline" className="w-full gap-2">
                <Link to="/driver/missions/$missionId" params={{ missionId: mission.id }}>
                  Voir la mission
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-display font-bold">Actions rapides</h3>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setSupportOpen(true)}
            >
              <LifeBuoy className="h-4 w-4" />
              Contacter le support
            </Button>
            <div className="space-y-2">
              <Textarea
                placeholder="Ajouter un commentaire…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <Button size="sm" className="w-full gap-2" onClick={addComment}>
                <MessageSquare className="h-4 w-4" />
                Ajouter un commentaire
              </Button>
            </div>
          </div>
        </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold truncate">{value}</div>
    </div>
  );
}
