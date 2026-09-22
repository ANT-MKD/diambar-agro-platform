import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Truck,
  Check,
  TriangleAlert,
  Repeat,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFCFA, relativeTime } from "@/lib/format";
import { useMission, useOrders, missionActions } from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import {
  useIncidents,
  incidentActions,
  INCIDENT_TYPE_LABEL,
  type IncidentType,
} from "@/data/business";
import { auditActions, useAdminRoleForEmail, can } from "@/data/admin-store";
import { farmers, restaurants, drivers, type MissionStatus } from "@/data/mocks";

export const Route = createFileRoute("/admin/deliveries/$missionId")({
  head: () => ({
    meta: [
      { title: "Détail livraison — Administration Diambar Agro" },
      {
        name: "description",
        content: "Trajet, participants, timeline et actions rapides pour une course.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDeliveryDetail,
});

const STATUS_LABEL: Record<MissionStatus, string> = {
  available: "Non assignée",
  accepted: "Acceptée",
  pickup: "Collecte en cours",
  loaded: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const INCIDENT_TYPES: IncidentType[] = [
  "client_absent",
  "refused",
  "breakdown",
  "accident",
  "traffic",
  "address",
  "other",
];

function AdminDeliveryDetail() {
  const { missionId } = Route.useParams();
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canReassignDeliveries = can(role, "deliveries.reassign");
  const mission = useMission(missionId);
  const orders = useOrders();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const navigate = useNavigate();

  const [reassignOpen, setReassignOpen] = useState(false);
  const [newDriverId, setNewDriverId] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentType>("other");
  const [incidentDesc, setIncidentDesc] = useState("");

  if (!mission) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Course introuvable</h2>
        <Link to="/admin/deliveries" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const farmer = farmers.find((f) => f.id === mission.farmerId);
  const restaurant = restaurants.find((r) => r.id === mission.restaurantId);
  const driver = mission.driverId ? drivers.find((d) => d.id === mission.driverId) : null;
  const order = orders.find((o) => o.reference === mission.orderRef);
  const dispute = disputes.find((d) => d.orderRef === mission.orderRef);
  const incident = incidents.find(
    (i) => i.missionRef === mission.reference && i.status !== "resolved",
  );
  const candidateDrivers = drivers.filter((d) => d.id !== mission.driverId);

  const history = [...(mission.statusHistory ?? [])].sort((a, b) => (a.at < b.at ? -1 : 1));

  const confirmReassign = () => {
    if (!newDriverId) {
      toast.error("Choisissez un livreur");
      return;
    }
    if (!canReassignDeliveries) {
      toast.error("Votre rôle ne permet pas de réaffecter une course.");
      return;
    }
    const newDriver = drivers.find((d) => d.id === newDriverId);
    const oldDriver = driver;
    missionActions.reassign(mission.id, newDriverId);
    auditActions.log({
      action: "Course réaffectée",
      target: mission.reference,
      module: "deliveries",
      actor: user.name,
      changes: [
        {
          field: "Livreur",
          before: oldDriver?.name ?? "Aucun livreur",
          after: newDriver?.name ?? "",
        },
      ],
    });
    toast.success(`${mission.reference} réaffectée à ${newDriver?.name}`);
    setReassignOpen(false);
    setNewDriverId("");
  };

  const submitIncident = () => {
    if (!incidentDesc.trim()) {
      toast.error("Décrivez le problème");
      return;
    }
    const item = incidentActions.create(
      {
        missionRef: mission.reference,
        type: incidentType,
        description: incidentDesc.trim(),
        waitedMinutes: 0,
        compensationRequested: 0,
      },
      user.name,
    );
    auditActions.log({
      action: `Incident créé depuis la livraison (${item.reference})`,
      target: mission.reference,
      module: "incidents",
      level: "attention",
      actor: user.name,
    });
    toast.success(`${item.reference} créé`);
    setIncidentOpen(false);
    setIncidentDesc("");
    navigate({ to: "/admin/incidents" });
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/deliveries"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Livraisons
      </Link>

      <PageHeader
        title={`Course ${mission.reference}`}
        subtitle={`${STATUS_LABEL[mission.status]} · Commande ${mission.orderRef}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {driver?.phone && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`tel:${driver.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Contacter le livreur
                </a>
              </Button>
            )}
            {restaurant?.phone && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`tel:${restaurant.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Contacter le client
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive"
              onClick={() => setIncidentOpen(true)}
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              Signaler un incident
            </Button>
            {mission.status !== "delivered" &&
              mission.status !== "cancelled" &&
              canReassignDeliveries && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setReassignOpen(true)}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Réaffecter
                </Button>
              )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 grid sm:grid-cols-3 gap-4">
            <Party
              label="Client"
              name={restaurant?.name}
              sub={restaurant?.city}
              avatar={restaurant?.avatar}
            />
            <Party
              label="Producteur"
              name={farmer?.farm ?? farmer?.name}
              sub={farmer?.city}
              avatar={farmer?.avatar}
            />
            <Party
              label="Livreur"
              name={driver?.name}
              sub={driver ? driver.vehicle : "Non assigné"}
              avatar={driver?.avatar}
            />
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Trajet
            </h2>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                {mission.pickup.address}
              </div>
              <div className="ml-1 h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                {mission.dropoff.address}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
              <span>{mission.distanceKm} km</span>
              <span>{mission.estimatedMinutes} min estimées</span>
              <span>Prévue {relativeTime(mission.scheduledFor)}</span>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Timeline</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Statut actuel : {STATUS_LABEL[mission.status]} — pas d'historique détaillé pour
                cette course.
              </p>
            ) : (
              <ol className="space-y-3 border-l-2 border-border pl-4">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="text-sm font-medium">{STATUS_LABEL[h.status]}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(h.at).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-2">
            <h2 className="font-semibold">Commande</h2>
            {order ? (
              <>
                <div className="text-sm text-muted-foreground">Montant</div>
                <div className="text-xl font-bold text-primary">{formatFCFA(order.total)}</div>
                <Link
                  to="/admin/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Voir la commande <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Commande introuvable.</p>
            )}
          </div>

          {incident && (
            <div className="glass rounded-2xl p-5 space-y-2 border border-amber-500/30">
              <h2 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-4 w-4" />
                Incident {incident.reference}
              </h2>
              <p className="text-sm text-muted-foreground">{incident.description}</p>
              <Link
                to="/admin/incidents"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir l'incident <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {dispute && (
            <div className="glass rounded-2xl p-5 space-y-2 border border-destructive/30">
              <h2 className="font-semibold text-destructive">Litige {dispute.reference}</h2>
              <p className="text-sm text-muted-foreground">{dispute.subcategory}</p>
              <Link
                to="/admin/disputes/$disputeId"
                params={{ disputeId: dispute.id }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir le litige <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réaffecter la course</DialogTitle>
            <DialogDescription>
              {driver ? `${driver.name} redevient disponible.` : "La course n'a pas de livreur."}
            </DialogDescription>
          </DialogHeader>
          <Select value={newDriverId} onValueChange={setNewDriverId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un livreur" />
            </SelectTrigger>
            <SelectContent>
              {candidateDrivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} · {d.vehicle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmReassign} className="gap-2">
              <Check className="h-4 w-4" />
              Réaffecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incidentOpen} onOpenChange={setIncidentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un incident</DialogTitle>
            <DialogDescription>Crée un dossier suivi dans Incidents.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={incidentType} onValueChange={(v) => setIncidentType(v as IncidentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {INCIDENT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              rows={4}
              placeholder="Décrivez le problème observé sur cette course…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitIncident} className="gap-2">
              <Truck className="h-4 w-4" />
              Créer l'incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Party({
  label,
  name,
  sub,
  avatar,
}: {
  label: string;
  name?: string;
  sub?: string;
  avatar?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        <img src={avatar} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center text-muted-foreground shrink-0">
          <Truck className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{name ?? "—"}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}
