import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Truck, Package, Wand2, MapPin, Clock } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { referenceDay, timeLabel } from "@/lib/driver-day";
import { useTours, tourActions } from "@/data/tours";
import { useMissions, useDriverVehicle } from "@/data/store";
import { restaurants, farmers } from "@/data/mocks";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";

export const Route = createFileRoute("/driver/routes/new")({
  head: () => ({ meta: [{ title: "Préparer ma tournée · Livreur Diambar" }] }),
  component: NewTour,
});

const STEPS = [
  "Missions incluses",
  "Vérification du véhicule",
  "Aperçu de l'itinéraire",
  "Confirmation",
];

function NewTour() {
  const navigate = useNavigate();
  const missions = useMissions();
  const vehicle = useDriverVehicle();
  const tours = useTours();
  const [step, setStep] = useState(1);

  const { today } = useMemo(() => referenceDay(missions), [missions]);
  // Le jour peut déjà être "en cours" si d'autres missions ont démarré :
  // ça n'empêche pas de préparer les missions encore juste acceptées.
  const tour = tours.find((t) => t.date === today && t.status !== "done");

  // Une tournée n'est pas un objet qu'on construit librement dans cette
  // appli : elle regroupe automatiquement toutes les missions acceptées
  // d'un même jour (voir data/tours.ts). Cet assistant guide donc la
  // préparation de la tournée du jour déjà réelle, plutôt que de simuler
  // une sélection arbitraire de missions qui n'existe pas dans le modèle.
  const includedMissions = missions.filter(
    (m) => m.driverId === "d1" && m.status === "accepted" && m.scheduledFor.slice(0, 10) === today,
  );

  if (!tour || includedMissions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Préparer ma tournée"
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link to="/driver/routes">
                <ArrowLeft className="h-4 w-4" />
                Tournées
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={Truck}
          title="Aucune mission à préparer"
          description="Acceptez au moins une mission pour aujourd'hui depuis l'onglet Missions."
          action={
            <Button asChild>
              <Link to="/driver/missions">Voir les missions</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const totalWeight = includedMissions.reduce((s, m) => s + m.weightKg, 0);
  const capacityOk = totalWeight <= vehicle.capacityKg;

  const mapMarkers = tour.stops.map((s, i) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    label: `${i + 1}`,
    color: (s.kind === "pickup" ? "amber" : "blue") as "amber" | "blue",
  }));

  const confirm = () => {
    tourActions.start(tour.stops);
    toast.success("Tournée démarrée");
    navigate({ to: "/driver/routes/$tourId", params: { tourId: tour.id } });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Créer une tournée"
        subtitle="Sélectionnez les missions et organisez votre tournée."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/driver/routes">
              <ArrowLeft className="h-4 w-4" />
              Tournées
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${step >= i + 1 ? "" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${step > i + 1 ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="font-display font-bold">Missions disponibles</h3>
            <p className="text-xs text-muted-foreground">
              Ces missions acceptées aujourd'hui seront regroupées automatiquement pour former votre
              tournée.
            </p>
            <div className="space-y-2">
              {includedMissions.map((m) => {
                const f = farmers.find((x) => x.id === m.farmerId);
                const r = restaurants.find((x) => x.id === m.restaurantId);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{m.reference}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {f?.farm} → {r?.name} · {m.weightKg} kg
                      </div>
                    </div>
                    <div className="text-right text-sm font-bold text-primary">
                      {formatFCFA(m.payout)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-display font-bold">Vérification du véhicule</h3>
            <div className="rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">
                  {vehicle.type} · {vehicle.brand} {vehicle.model}
                </div>
                <div className="text-xs text-muted-foreground">
                  Capacité : {vehicle.capacityKg} kg
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Poids total sélectionné</span>
              <span className="font-semibold">{totalWeight} kg</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${capacityOk ? "bg-emerald-500" : "bg-destructive"}`}
                style={{ width: `${Math.min(100, (totalWeight / vehicle.capacityKg) * 100)}%` }}
              />
            </div>
            <p
              className={`text-xs font-semibold ${capacityOk ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
            >
              {capacityOk
                ? "Capacité respectée."
                : `Capacité dépassée de ${totalWeight - vehicle.capacityKg} kg — retirez une mission ou changez de véhicule dans Paramètres.`}
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold">Aperçu de l'itinéraire</h3>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  tourActions.optimize(tour.id, tour.stops);
                  toast.success("Itinéraire optimisé (distances réelles)");
                }}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Optimiser
              </Button>
            </div>
            <DiambarMapLazy markers={mapMarkers} minHeight={280} zoom={10} fitBounds />
            <ol className="space-y-1.5">
              {tour.stops.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span
                    className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${s.kind === "pickup" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}
                  >
                    {s.kind === "pickup" ? "Collecte" : "Livraison"}
                  </span>
                  <span className="truncate flex-1">{s.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeLabel(s.scheduledFor)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-display font-bold">Détails de la tournée</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Distance estimée
                </div>
                <div className="mt-1 font-semibold">{tour.distanceKm} km</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <Package className="h-3 w-3" />
                  Arrêts
                </div>
                <div className="mt-1 font-semibold">{tour.stops.length}</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Gains estimés
                </div>
                <div className="mt-1 font-semibold text-primary">{formatFCFA(tour.payout)}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              En confirmant, vos missions acceptées aujourd'hui passent en statut « en pickup » et
              votre tournée démarre.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        {step < STEPS.length ? (
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
            disabled={step === 2 && !capacityOk}
            className="gap-2"
          >
            Étape suivante <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={confirm} className="gap-2">
            Démarrer la tournée <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
