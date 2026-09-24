import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Truck,
  TriangleAlert,
  Wallet,
  Clock,
  MapPin,
  Check,
  X,
  Repeat,
  ExternalLink,
  ImageIcon,
  Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  useIncidents,
  incidentActions,
  INCIDENT_TYPE_LABEL,
  INCIDENT_STATUS_LABEL,
  INCIDENT_SEVERITY_LABEL,
  type IncidentStatus,
  type IncidentSeverity,
} from "@/data/business";
import { useMissions, useOrders, missionActions, useReassignCandidates } from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { refundActions, type RefundMethod } from "@/data/finance";
import { auditActions, useAdminRoleForEmail, can } from "@/data/admin-store";
import { farmers, restaurants, drivers } from "@/data/mocks";

export const Route = createFileRoute("/admin/incidents/$incidentId")({
  head: () => ({
    meta: [
      { title: "Détail incident — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminIncidentDetail,
});

const STATUS_CLASS: Record<IncidentStatus, string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  escalated: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const SEVERITY_CLASS: Record<IncidentSeverity, string> = {
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

function AdminIncidentDetail() {
  const { incidentId } = Route.useParams();
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canDecideIncidents = can(role, "incidents.decide");
  const canReassignDeliveries = can(role, "deliveries.reassign");
  const incidents = useIncidents();
  const missions = useMissions();
  const orders = useOrders();
  const disputes = useAllDisputes();
  const navigate = useNavigate();

  const incident = incidents.find((i) => i.id === incidentId);
  const candidates = useReassignCandidates(
    incident ? missions.find((m) => m.reference === incident.missionRef) : undefined,
  );

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [newDriverId, setNewDriverId] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("Wave");
  const [refundReason, setRefundReason] = useState("");

  if (!incident) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Incident introuvable</h2>
        <Link to="/admin/incidents" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const mission = missions.find((m) => m.reference === incident.missionRef);
  const farmer = mission ? farmers.find((f) => f.id === mission.farmerId) : undefined;
  const restaurant = mission ? restaurants.find((r) => r.id === mission.restaurantId) : undefined;
  const driver = mission?.driverId ? drivers.find((d) => d.id === mission.driverId) : undefined;
  const order = mission ? orders.find((o) => o.reference === mission.orderRef) : undefined;
  const dispute = mission ? disputes.find((d) => d.orderRef === mission.orderRef) : undefined;

  const startDeciding = () => {
    setAmount(String(incident.compensationRequested));
    setNote("");
    setDeciding(true);
  };

  const cancelDeciding = () => {
    setDeciding(false);
    setAmount("");
    setNote("");
  };

  const award = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Indiquez un montant valide");
      return;
    }
    if (!canDecideIncidents) {
      toast.error("Votre rôle ne permet pas de traiter cet incident.");
      return;
    }
    incidentActions.resolve(incident.id, value, note.trim() || undefined, user.name);
    auditActions.log({
      action: value > 0 ? "Incident indemnisé" : "Incident clôturé sans indemnité",
      target: incident.reference,
      module: "incidents",
      actor: user.name,
      reason: note.trim() || undefined,
      changes:
        value > 0
          ? [{ field: "Indemnité", before: "0 FCFA", after: formatFCFA(value) }]
          : undefined,
    });
    toast.success(
      value > 0 ? `Indemnité de ${formatFCFA(value)} versée au livreur` : "Incident clôturé",
    );
    cancelDeciding();
  };

  const reject = () => {
    if (!canDecideIncidents) {
      toast.error("Votre rôle ne permet pas de traiter cet incident.");
      return;
    }
    incidentActions.resolve(incident.id, 0, note.trim() || "Demande jugée non fondée", user.name);
    auditActions.log({
      action: "Indemnité refusée",
      target: incident.reference,
      module: "incidents",
      level: "attention",
      actor: user.name,
      reason: note.trim() || "Demande jugée non fondée",
    });
    toast.success("Demande d'indemnité refusée");
    cancelDeciding();
  };

  const confirmReassign = () => {
    if (!mission || !newDriverId) {
      toast.error("Choisissez un livreur");
      return;
    }
    if (!canReassignDeliveries) {
      toast.error("Votre rôle ne permet pas de réaffecter une course.");
      return;
    }
    const newDriver = drivers.find((d) => d.id === newDriverId);
    const result = missionActions.reassign(mission.id, newDriverId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    auditActions.log({
      action: "Course réaffectée",
      target: mission.reference,
      module: "deliveries",
      actor: user.name,
      changes: [
        { field: "Livreur", before: driver?.name ?? "Aucun livreur", after: newDriver?.name ?? "" },
      ],
    });
    toast.success(`${mission.reference} réaffectée à ${newDriver?.name}`);
    setReassignOpen(false);
    setNewDriverId("");
  };

  const openRefund = () => {
    setRefundAmount(String(incident.compensationRequested || ""));
    setRefundReason(`Incident ${incident.reference} — ${INCIDENT_TYPE_LABEL[incident.type]}`);
    setRefundMethod("Wave");
    setRefundOpen(true);
  };

  const submitRefund = () => {
    const value = Number(refundAmount);
    if (!order || !restaurant) return;
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Indiquez un montant valide");
      return;
    }
    if (!canDecideIncidents) {
      toast.error("Votre rôle ne permet pas de créer un remboursement depuis cet incident.");
      return;
    }
    const refund = refundActions.create(
      {
        source: "incident",
        incidentId: incident.id,
        orderRef: order.reference,
        // Un incident de livraison n'est pas imputable au producteur : la
        // charge reste plateforme, sauf décision explicite contraire au cas
        // par cas (pas de déduction automatique du livreur ou du producteur).
        bornBy: "platform",
        requester: restaurant.name,
        amount: value,
        method: refundMethod,
        reason: refundReason.trim() || `Incident ${incident.reference}`,
      },
      "pending",
      user.name,
    );
    auditActions.log({
      action: `Remboursement client créé depuis l'incident (${refund.reference})`,
      target: incident.reference,
      module: "refunds",
      actor: user.name,
    });
    toast.success(`${refund.reference} créé`);
    setRefundOpen(false);
    navigate({ to: "/admin/refunds/$refundId", params: { refundId: refund.id } });
  };

  const statut =
    incident.status !== "resolved"
      ? "En attente"
      : (incident.compensationAwarded ?? 0) > 0
        ? "Accordée"
        : "Refusée";

  return (
    <div className="space-y-6">
      <Link
        to="/admin/incidents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Incidents
      </Link>

      <PageHeader
        title={incident.reference}
        subtitle={`Signalé ${relativeTime(incident.createdAt)} · Mission ${incident.missionRef}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {order && restaurant && canDecideIncidents && (
              <Button variant="outline" size="sm" className="gap-2" onClick={openRefund}>
                <Banknote className="h-3.5 w-3.5" />
                Rembourser le client
              </Button>
            )}
            {mission &&
              mission.status !== "delivered" &&
              mission.status !== "cancelled" &&
              canReassignDeliveries && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setReassignOpen(true)}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Réaffecter le livreur
                </Button>
              )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASS[incident.status]}`}
        >
          {INCIDENT_STATUS_LABEL[incident.status]}
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${SEVERITY_CLASS[incident.severity]}`}
        >
          Gravité {INCIDENT_SEVERITY_LABEL[incident.severity]}
        </span>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          {INCIDENT_TYPE_LABEL[incident.type]}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatPill icon={Truck} label="Mission" value={incident.missionRef} />
        <StatPill icon={Clock} label="Temps d'attente" value={`${incident.waitedMinutes} min`} />
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
            {mission && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <MapPin className="h-3.5 w-3.5" />
                Adresse :{" "}
                <span className="font-medium text-foreground">{mission.dropoff.address}</span>
              </div>
            )}
          </div>

          {incident.photos && incident.photos.length > 0 && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-display font-bold">Preuves jointes ({incident.photos.length})</h3>
              <div className="grid gap-3 sm:grid-cols-3">
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
            {incident.status === "resolved" && incident.resolutionNote && (
              <p className="pt-1 text-xs text-muted-foreground">Note : {incident.resolutionNote}</p>
            )}

            {incident.status !== "resolved" &&
              canDecideIncidents &&
              (deciding ? (
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
                    <Button size="sm" className="gap-2" onClick={award}>
                      <Check className="h-4 w-4" />
                      Accorder
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2" onClick={reject}>
                      <X className="h-4 w-4" />
                      Refuser
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelDeciding}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="w-full mt-1" onClick={startDeciding}>
                  Traiter le dossier
                </Button>
              ))}
          </div>

          {mission && (
            <div className="glass rounded-2xl p-5 space-y-2">
              <h3 className="font-display font-bold">Mission associée</h3>
              <div className="text-sm">
                {farmer?.farm ?? farmer?.name} → {restaurant?.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Livreur : {driver?.name ?? "Non assigné"}
              </div>
              <Link
                to="/admin/deliveries/$missionId"
                params={{ missionId: mission.id }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir la course <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {order && (
            <div className="glass rounded-2xl p-5 space-y-2">
              <h3 className="font-display font-bold">Commande</h3>
              <div className="text-xl font-bold text-primary">{formatFCFA(order.total)}</div>
              <Link
                to="/admin/orders/$orderId"
                params={{ orderId: order.id }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir la commande <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {dispute && (
            <div className="glass rounded-2xl p-5 space-y-2 border border-destructive/30">
              <h3 className="font-display font-bold text-destructive">
                Litige {dispute.reference}
              </h3>
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
              {candidates.map(({ driver: d, fleet, eligibility }) => (
                <SelectItem key={d.id} value={d.id} disabled={!eligibility.ok}>
                  {d.name} · {fleet ? `${fleet.type} ${fleet.capacityKg} kg` : d.vehicle}
                  {!eligibility.ok && ` — ${eligibility.message}`}
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

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rembourser le client</DialogTitle>
            <DialogDescription>
              Crée un dossier suivi dans Remboursements pour {restaurant?.name}, lié à cet incident.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Montant (FCFA)</label>
              <Input
                inputMode="numeric"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Wave", "Orange Money", "Free Money", "Virement"] as RefundMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
              placeholder="Motif du remboursement…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitRefund} className="gap-2">
              <Banknote className="h-4 w-4" />
              Créer le remboursement
            </Button>
          </DialogFooter>
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
