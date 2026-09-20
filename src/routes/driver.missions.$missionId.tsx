import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageSquare,
  Truck,
  Clock,
  Package,
  Route as RouteIcon,
  Check,
  X,
  Navigation,
  User,
  Building2,
  TriangleAlert,
  Camera,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import {
  useMission,
  missionActions,
  useDriverConversations,
  useOrders,
  useProducts,
  useDriverVehicle,
  useDriverSettings,
} from "@/data/store";
import { GpsPanel } from "@/components/driver/gps-panel";
import { FileDrop } from "@/components/disputes/file-drop";
import type { DisputeAttachment } from "@/data/disputes";
import { farmers, restaurants, type MissionStatus } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { timeLabel } from "@/lib/driver-day";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/driver/missions/$missionId")({
  head: () => ({ meta: [{ title: "Mission · Livreur Diambar" }] }),
  component: MissionDetail,
});

const STEP_LABEL = {
  available: "Disponible",
  accepted: "Acceptée",
  pickup: "En route vers le producteur",
  loaded: "Marchandise chargée · en livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
} as const;

const FLOW: Array<{ status: "accepted" | "pickup" | "loaded" | "delivered"; label: string }> = [
  { status: "accepted", label: "Mission acceptée" },
  { status: "pickup", label: "En route vers le producteur" },
  { status: "loaded", label: "Marchandise récupérée" },
  { status: "delivered", label: "Livraison confirmée" },
];

function MissionDetail() {
  const navigate = useNavigate();
  const { missionId } = Route.useParams();
  const mission = useMission(missionId);
  const conversations = useDriverConversations();
  const orders = useOrders();
  const products = useProducts();
  const vehicle = useDriverVehicle();
  const settings = useDriverSettings();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofPhotos, setProofPhotos] = useState<DisputeAttachment[]>([]);

  if (!mission) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h3 className="font-semibold">Mission introuvable</h3>
        <Button asChild className="mt-3">
          <Link to="/driver/missions">Retour aux missions</Link>
        </Button>
      </div>
    );
  }

  const r = restaurants.find((x) => x.id === mission.restaurantId);
  const f = farmers.find((x) => x.id === mission.farmerId);
  const activeIndex = FLOW.findIndex((s) => s.status === mission.status);
  const stepAt = (status: MissionStatus) =>
    mission.statusHistory?.find((h) => h.status === status)?.at;

  // La correspondance orderRef ↔ commande réelle n'existe que pour une
  // partie des missions de démo (données seedées indépendamment) : on
  // enrichit avec le vrai contenu quand elle existe, sinon on garde le
  // résumé agrégé plutôt que d'inventer une liste d'articles.
  const linkedOrder = orders.find((o) => o.reference === mission.orderRef);
  const orderItems = linkedOrder?.items.map((it) => ({
    ...it,
    name: products.find((p) => p.id === it.productId)?.name ?? it.productId,
  }));

  const conversation = conversations.find((c) => c.restaurantId === mission.restaurantId);

  const navTarget = mission.status === "loaded" ? mission.dropoff : mission.pickup;
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${navTarget.lat},${navTarget.lng}`;

  const accept = () => {
    missionActions.accept(mission.id);
    toast.success("Mission acceptée");
  };
  const startPickup = () => {
    missionActions.setStatus(mission.id, "pickup");
    toast.success("Trajet vers le producteur démarré");
  };
  const markLoaded = () => {
    missionActions.setStatus(mission.id, "loaded");
    toast.success("Marchandise chargée · direction restaurant");
  };
  const markDelivered = () => {
    if (proofPhotos.length > 0) missionActions.attachProof(mission.id, proofPhotos);
    missionActions.setStatus(mission.id, "delivered");
    toast.success("Livraison confirmée · paiement en cours");
    setProofOpen(false);
    setTimeout(() => navigate({ to: "/driver/missions" }), 500);
  };
  const refuse = () => {
    missionActions.cancel(mission.id);
    toast.success("Mission refusée");
    setRefuseOpen(false);
    navigate({ to: "/driver/missions" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={mission.reference}
        subtitle={`${STEP_LABEL[mission.status]} · Commande ${mission.orderRef}`}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/driver/missions">
              <ArrowLeft className="h-4 w-4" />
              Missions
            </Link>
          </Button>
        }
      />

      {/* Barre de stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={RouteIcon} label="Distance" value={`${mission.distanceKm} km`} />
        <StatPill icon={Clock} label="Temps estimé" value={`~ ${mission.estimatedMinutes} min`} />
        <StatPill
          icon={Package}
          label="Poids total"
          value={`${mission.weightKg} kg`}
          tone={
            mission.weightKg > vehicle.capacityKg ? "text-rose-600 dark:text-rose-400" : undefined
          }
        />
        <StatPill
          icon={Wallet}
          label="Gain"
          value={formatFCFA(mission.payout)}
          tone="text-primary"
        />
      </div>

      {mission.weightKg > vehicle.capacityKg && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>
            Véhicule incompatible : {mission.weightKg} kg à transporter pour une capacité de{" "}
            {vehicle.capacityKg} kg ({vehicle.type} {vehicle.brand} {vehicle.model}).
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Avancement */}
          {mission.status !== "available" && mission.status !== "cancelled" && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-display font-bold mb-4">Avancement de la mission</h3>
              <ul className="space-y-3">
                {FLOW.map((s, i) => {
                  const done = i <= activeIndex;
                  const current = i === activeIndex;
                  const at = stepAt(s.status);
                  return (
                    <li key={s.status} className="flex items-start gap-3">
                      <div
                        className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${done ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"}`}
                      >
                        {i < activeIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1">
                        <div
                          className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}
                        >
                          {s.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {at
                            ? `${new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${timeLabel(at)}`
                            : current
                              ? "En cours"
                              : "À venir"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {activeIndex >= 0 && activeIndex < FLOW.length - 1 && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-primary">
                      Prochaine étape
                    </div>
                    <div className="text-sm font-medium">{FLOW[activeIndex + 1].label}</div>
                  </div>
                  <Button asChild size="sm" className="gap-2">
                    <a href={navUrl} target="_blank" rel="noopener noreferrer">
                      <Navigation className="h-3.5 w-3.5" />
                      Démarrer la navigation
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Adresses */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Navigation className="h-5 w-5 text-primary" />
              Itinéraire
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <AddressCard
                variant="pickup"
                title={f?.farm ?? "Pickup"}
                subtitle={f?.name ?? ""}
                address={mission.pickup.address}
                city={mission.pickup.city}
                phone={mission.pickup.contactPhone}
                lat={mission.pickup.lat}
                lng={mission.pickup.lng}
              />
              <AddressCard
                variant="dropoff"
                title={r?.name ?? "Livraison"}
                subtitle={r?.city ?? ""}
                address={mission.dropoff.address}
                city={mission.dropoff.city}
                phone={mission.dropoff.contactPhone}
                lat={mission.dropoff.lat}
                lng={mission.dropoff.lng}
              />
            </div>
          </div>

          {/* Live GPS */}
          <GpsPanel
            trackingId={mission.reference}
            distanceKm={mission.distanceKm}
            estimatedMinutes={mission.estimatedMinutes}
            driverName="Vous"
            live={mission.status === "pickup" || mission.status === "loaded"}
            defaultShare={settings.locationSharing}
          />

          {/* Récap commande */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Contenu de la mission
            </h3>
            {orderItems && orderItems.length > 0 ? (
              <div className="mt-3 divide-y divide-border">
                {orderItems.map((it) => (
                  <div
                    key={it.productId}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>{it.name}</span>
                    <span className="text-muted-foreground">{it.qty} kg</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <Stat label="Articles" value={`${mission.itemsCount}`} />
                <Stat label="Poids" value={`${mission.weightKg} kg`} />
                <Stat label="Véhicule" value={mission.vehicleType} />
              </div>
            )}
          </div>

          {/* Preuve de livraison */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Preuve de livraison
            </h3>
            {mission.proof && mission.proof.length > 0 ? (
              <div className="mt-3 flex gap-2">
                {mission.proof.map((p) =>
                  p.dataUrl ? (
                    <img
                      key={p.id}
                      src={p.dataUrl}
                      alt="Preuve de livraison"
                      className="h-20 w-20 rounded-lg object-cover border border-border"
                    />
                  ) : null,
                )}
              </div>
            ) : mission.status === "loaded" ? (
              <button
                onClick={() => setProofOpen(true)}
                className="mt-3 w-full rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground hover:bg-accent/40 transition"
              >
                Ajouter une photo (obligatoire à la livraison)
              </button>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {mission.status === "delivered"
                  ? "Aucune photo fournie pour cette livraison."
                  : "Disponible une fois la marchandise récupérée."}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6 lg:sticky lg:top-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Rémunération
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">
              {formatFCFA(mission.payout)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniStat icon={RouteIcon} label={`${mission.distanceKm} km`} />
              <MiniStat icon={Clock} label={`~ ${mission.estimatedMinutes} min`} />
            </div>

            <div className="mt-4 space-y-2">
              {mission.status === "available" && (
                <>
                  <Button className="w-full gap-2" onClick={accept}>
                    <Truck className="h-4 w-4" />
                    Accepter la mission
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-rose-500 hover:text-rose-600 gap-2"
                    onClick={() => setRefuseOpen(true)}
                  >
                    <X className="h-4 w-4" />
                    Refuser
                  </Button>
                </>
              )}
              {mission.status === "accepted" && (
                <Button className="w-full gap-2" onClick={startPickup}>
                  <Navigation className="h-4 w-4" />
                  Démarrer le trajet
                </Button>
              )}
              {mission.status === "pickup" && (
                <Button className="w-full gap-2" onClick={markLoaded}>
                  <Package className="h-4 w-4" />
                  Marchandise récupérée
                </Button>
              )}
              {mission.status === "loaded" && (
                <Button className="w-full gap-2" onClick={() => setProofOpen(true)}>
                  <Check className="h-4 w-4" />
                  Confirmer la livraison
                </Button>
              )}
              {mission.status === "delivered" && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 text-xs font-semibold flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Livraison terminée · paiement programmé
                </div>
              )}
              {mission.status === "cancelled" && (
                <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  Mission annulée.
                </div>
              )}
            </div>
          </div>

          {/* Actions rapides */}
          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Actions rapides
            </div>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/driver/incidents" search={{ missionRef: mission.reference }}>
                <TriangleAlert className="h-4 w-4" />
                Signaler un incident
              </Link>
            </Button>
            {conversation ? (
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link
                  to="/driver/messages/$conversationId"
                  params={{ conversationId: conversation.id }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Contacter le restaurant
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/driver/messages">
                  <MessageSquare className="h-4 w-4" />
                  Contacter le restaurant
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/driver/routes">
                <RouteIcon className="h-4 w-4" />
                Voir ma tournée
              </Link>
            </Button>
          </div>

          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Contacts
            </div>
            <a
              href={`tel:${mission.pickup.contactPhone}`}
              className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-accent transition text-xs"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{f?.name}</div>
                <div className="text-muted-foreground">{mission.pickup.contactPhone}</div>
              </div>
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <a
              href={`tel:${mission.dropoff.contactPhone}`}
              className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-accent transition text-xs"
            >
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{r?.name}</div>
                <div className="text-muted-foreground">{mission.dropoff.contactPhone}</div>
              </div>
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>

      <AlertDialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser cette mission ?</AlertDialogTitle>
            <AlertDialogDescription>
              {mission.reference} · {formatFCFA(mission.payout)}. Elle sera renvoyée à un autre
              livreur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={refuse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={proofOpen} onOpenChange={setProofOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preuve de livraison</AlertDialogTitle>
            <AlertDialogDescription>
              Ajoutez une photo (facultatif) et confirmez la remise. Le paiement de{" "}
              {formatFCFA(mission.payout)} sera programmé sous 24h.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FileDrop
            value={proofPhotos}
            onChange={setProofPhotos}
            by="Vous"
            kind="photo"
            label="Photo de livraison"
            accept="image/*"
            max={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={markDelivered}>Confirmer la livraison</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddressCard({
  variant,
  title,
  subtitle,
  address,
  city,
  phone,
  lat,
  lng,
}: {
  variant: "pickup" | "dropoff";
  title: string;
  subtitle: string;
  address: string;
  city: string;
  phone: string;
  lat: number;
  lng: number;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${variant === "pickup" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-primary/5 border-primary/20"}`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-wider ${variant === "pickup" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}
      >
        {variant === "pickup" ? "① Pickup" : "② Livraison"}
      </div>
      <div className="mt-1 font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-2 text-xs flex items-start gap-1.5">
        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        {address}, {city}
      </div>
      <div className="mt-1 text-xs flex items-center gap-1.5 text-muted-foreground">
        <Phone className="h-3.5 w-3.5" />
        {phone}
      </div>
      <div className="mt-2 flex gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center rounded-lg border border-border py-1.5 text-[11px] font-semibold hover:bg-accent transition"
        >
          Google Maps
        </a>
        <a
          href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center rounded-lg border border-border py-1.5 text-[11px] font-semibold hover:bg-accent transition"
        >
          Waze
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function MiniStat({ icon: Icon, label }: { icon: typeof Truck; label: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2 flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-1 font-display text-lg font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
