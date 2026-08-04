import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Phone, MessageSquare, Truck, Clock, Package, Route as RouteIcon, Check, X, Navigation, Camera, User, Building2 } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { useMission, missionActions, driverNotifActions } from "@/data/store";
import { farmers, restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  { status: "accepted", label: "Acceptée" },
  { status: "pickup", label: "En pickup" },
  { status: "loaded", label: "Chargée" },
  { status: "delivered", label: "Livrée" },
];

function MissionDetail() {
  const navigate = useNavigate();
  const { missionId } = Route.useParams();
  const mission = useMission(missionId);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  if (!mission) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h3 className="font-semibold">Mission introuvable</h3>
        <Button asChild className="mt-3"><Link to="/driver/missions">Retour aux missions</Link></Button>
      </div>
    );
  }

  const r = restaurants.find((x) => x.id === mission.restaurantId);
  const f = farmers.find((x) => x.id === mission.farmerId);
  const activeIndex = FLOW.findIndex((s) => s.status === mission.status);

  const accept = () => {
    missionActions.accept(mission.id);
    driverNotifActions.add({ type: "order", title: "Mission acceptée", body: `${mission.reference} · pickup ${new Date(mission.scheduledFor).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` });
    toast.success("Mission acceptée");
  };
  const startPickup = () => { missionActions.setStatus(mission.id, "pickup"); toast.success("Trajet vers le producteur démarré"); };
  const markLoaded = () => { missionActions.setStatus(mission.id, "loaded"); toast.success("Marchandise chargée · direction restaurant"); };
  const markDelivered = () => {
    missionActions.setStatus(mission.id, "delivered");
    driverNotifActions.add({ type: "payment", title: "Paiement programmé", body: `Wave · +${formatFCFA(mission.payout)} (${mission.reference})` });
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
        actions={<Button asChild variant="outline" className="gap-2"><Link to="/driver/missions"><ArrowLeft className="h-4 w-4" />Missions</Link></Button>}
      />

      {/* Progress */}
      {mission.status !== "available" && mission.status !== "cancelled" && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2">
            {FLOW.map((s, i) => {
              const done = i <= activeIndex;
              const current = i === activeIndex;
              return (
                <div key={s.status} className="flex-1 flex items-center gap-2">
                  <motion.div initial={false} animate={{ scale: current ? 1.08 : 1 }} className={`h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${done ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"}`}>
                    {i < activeIndex ? <Check className="h-4 w-4" /> : i + 1}
                  </motion.div>
                  <span className={`text-xs font-medium hidden sm:inline ${done ? "" : "text-muted-foreground"}`}>{s.label}</span>
                  {i < FLOW.length - 1 && <div className={`flex-1 h-px ${i < activeIndex ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Adresses */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2"><Navigation className="h-5 w-5 text-primary" />Itinéraire</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <AddressCard
                variant="pickup"
                title={f?.farm ?? "Pickup"}
                subtitle={f?.name ?? ""}
                address={mission.pickup.address}
                city={mission.pickup.city}
                phone={mission.pickup.contactPhone}
              />
              <AddressCard
                variant="dropoff"
                title={r?.name ?? "Livraison"}
                subtitle={r?.city ?? ""}
                address={mission.dropoff.address}
                city={mission.dropoff.city}
                phone={mission.dropoff.contactPhone}
              />
            </div>
          </div>

          {/* Live GPS (simulé) */}
          <GpsPanel
            pickupCity={mission.pickup.city}
            dropoffCity={mission.dropoff.city}
            distanceKm={mission.distanceKm}
            estimatedMinutes={mission.estimatedMinutes}
            driverName="Vous"
            live={mission.status === "pickup" || mission.status === "loaded"}
            startProgress={mission.status === "loaded" ? 0.45 : mission.status === "delivered" ? 1 : 0.05}
          />

          {/* Récap commande */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Contenu de la mission</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <Stat label="Articles" value={`${mission.itemsCount}`} />
              <Stat label="Poids" value={`${mission.weightKg} kg`} />
              <Stat label="Véhicule" value={mission.vehicleType} />
            </div>
          </div>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6 lg:sticky lg:top-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Rémunération</div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">{formatFCFA(mission.payout)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniStat icon={RouteIcon} label={`${mission.distanceKm} km`} />
              <MiniStat icon={Clock} label={`~ ${mission.estimatedMinutes} min`} />
            </div>

            <div className="mt-4 space-y-2">
              {mission.status === "available" && (
                <>
                  <Button className="w-full gap-2" onClick={accept}><Truck className="h-4 w-4" />Accepter la mission</Button>
                  <Button variant="outline" className="w-full text-rose-500 hover:text-rose-600 gap-2" onClick={() => setRefuseOpen(true)}><X className="h-4 w-4" />Refuser</Button>
                </>
              )}
              {mission.status === "accepted" && <Button className="w-full gap-2" onClick={startPickup}><Navigation className="h-4 w-4" />Démarrer le trajet</Button>}
              {mission.status === "pickup" && <Button className="w-full gap-2" onClick={markLoaded}><Package className="h-4 w-4" />Marchandise récupérée</Button>}
              {mission.status === "loaded" && <Button className="w-full gap-2" onClick={() => setProofOpen(true)}><Check className="h-4 w-4" />Confirmer la livraison</Button>}
              {mission.status === "delivered" && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 text-xs font-semibold flex items-center gap-2">
                  <Check className="h-4 w-4" />Livraison terminée · paiement programmé
                </div>
              )}
              {mission.status === "cancelled" && (
                <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Mission annulée.</div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Contacts</div>
            <a href={`tel:${mission.pickup.contactPhone}`} className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-accent transition text-xs">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><User className="h-3.5 w-3.5" /></div>
              <div className="flex-1"><div className="font-semibold">{f?.name}</div><div className="text-muted-foreground">{mission.pickup.contactPhone}</div></div>
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <a href={`tel:${mission.dropoff.contactPhone}`} className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-accent transition text-xs">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400"><Building2 className="h-3.5 w-3.5" /></div>
              <div className="flex-1"><div className="font-semibold">{r?.name}</div><div className="text-muted-foreground">{mission.dropoff.contactPhone}</div></div>
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            <Button asChild variant="outline" className="w-full gap-2 mt-2"><Link to="/driver/messages"><MessageSquare className="h-4 w-4" />Ouvrir la messagerie</Link></Button>
          </div>
        </div>
      </div>

      <AlertDialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser cette mission ?</AlertDialogTitle>
            <AlertDialogDescription>
              {mission.reference} · {formatFCFA(mission.payout)}. Elle sera renvoyée à un autre livreur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={refuse} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Refuser</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={proofOpen} onOpenChange={setProofOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preuve de livraison</AlertDialogTitle>
            <AlertDialogDescription>
              Prenez une photo (mock) et confirmez la remise. Le paiement de {formatFCFA(mission.payout)} sera programmé sous 24h.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border-2 border-dashed border-border p-8 grid place-items-center text-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">Ajouter une photo (facultatif)</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={markDelivered}>Confirmer la livraison</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddressCard({ variant, title, subtitle, address, city, phone }: { variant: "pickup" | "dropoff"; title: string; subtitle: string; address: string; city: string; phone: string }) {
  return (
    <div className={`rounded-xl border p-4 ${variant === "pickup" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-primary/5 border-primary/20"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${variant === "pickup" ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`}>
        {variant === "pickup" ? "① Pickup" : "② Livraison"}
      </div>
      <div className="mt-1 font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-2 text-xs flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />{address}, {city}</div>
      <div className="mt-1 text-xs flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{phone}</div>
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
      <Icon className="h-3 w-3" />{label}
    </div>
  );
}