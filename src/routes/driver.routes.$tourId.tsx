import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Route as RouteIcon,
  ArrowUp,
  ArrowDown,
  Wand2,
  Play,
  CheckCircle2,
  Phone,
  Package,
  MapPin,
  Download,
  Clock,
  Navigation,
  TriangleAlert,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { timeLabel } from "@/lib/driver-day";
import { useTours, tourActions, type TourStop } from "@/data/tours";
import { useDriverConversations, useMissions } from "@/data/store";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";

export const Route = createFileRoute("/driver/routes/$tourId")({
  head: () => ({ meta: [{ title: "Tournée · Livreur Diambar" }] }),
  component: TourDetail,
});

const STATUS_LABEL = { planned: "Planifiée", running: "En cours", done: "Terminée" } as const;

function TourDetail() {
  const { tourId } = Route.useParams();
  const tours = useTours();
  const missions = useMissions();
  const conversations = useDriverConversations();
  const t = tours.find((x) => x.id === tourId);

  if (!t) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h3 className="font-semibold">Tournée introuvable</h3>
        <Button asChild className="mt-3">
          <Link to="/driver/routes">Retour aux tournées</Link>
        </Button>
      </div>
    );
  }

  const done = t.stops.filter((s) => s.done).length;
  const pct = Math.round((done / t.stops.length) * 100);
  const nextStop = t.stops.find((s) => !s.done) ?? null;
  const nextMission = nextStop ? missions.find((m) => m.id === nextStop.missionId) : null;
  const conversation = nextMission
    ? conversations.find((c) => c.restaurantId === nextMission.restaurantId)
    : null;

  const toggleStop = (stop: TourStop) => {
    const result = tourActions.toggleStop(stop);
    if (result === "blocked") {
      toast.error("Confirmez d'abord la collecte de cette mission");
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `tournee-${t.reference}.csv`,
      [
        "Ordre",
        "Type",
        "Point",
        "Adresse",
        "Ville",
        "Heure prévue",
        "Poids (kg)",
        "Mission",
        "Fait",
      ],
      t.stops.map((s, i) => [
        i + 1,
        s.kind === "pickup" ? "Collecte" : "Livraison",
        s.label,
        s.address,
        s.city,
        timeLabel(s.scheduledFor),
        s.weightKg,
        s.missionRef,
        s.done ? "Oui" : "Non",
      ]),
    );
  };

  const mapMarkers = t.stops.map((s, i) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    label: `${i + 1}. ${s.label}`,
    color: (s.done ? "emerald" : s.kind === "pickup" ? "amber" : "blue") as
      "emerald" | "amber" | "blue",
    description: s.kind === "pickup" ? "Collecte" : "Livraison",
  }));
  const mapRoutes = [
    { points: t.stops.map((s) => ({ lat: s.lat, lng: s.lng })), color: "#3b82f6", weight: 3 },
  ];
  const mapCenter: [number, number] | undefined = t.stops[0]
    ? [t.stops[0].lat, t.stops[0].lng]
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tournée ${t.reference}`}
        subtitle={`${STATUS_LABEL[t.status]} · ${t.date}`}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/driver/routes">
              <ArrowLeft className="h-4 w-4" />
              Tournées
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill icon={RouteIcon} label="Arrêts" value={`${t.stops.length}`} />
        <StatPill icon={Clock} label="Distance" value={`${t.distanceKm} km`} />
        <StatPill icon={Package} label="Véhicule" value={t.vehicle.split(" · ")[0]} />
        <StatPill icon={Wallet} label="Gains" value={formatFCFA(t.payout)} tone="text-primary" />
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold">Avancement</h3>
          <span className="text-xs text-muted-foreground">
            {done}/{t.stops.length} arrêts validés
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {t.stops.map((s, i) => (
            <div
              key={s.id}
              className={`shrink-0 rounded-xl border p-2.5 min-w-[110px] text-center ${s.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}
            >
              <div
                className={`mx-auto h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}
              >
                {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <div className="mt-1 text-[10px] font-semibold">
                {s.kind === "pickup" ? "Collecte" : "Livraison"}
              </div>
              <div className="text-[11px] truncate">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {nextStop && (
            <div className="glass rounded-2xl p-5 border-l-4 border-primary">
              <div className="text-[10px] uppercase font-semibold text-primary">Prochain arrêt</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${nextStop.kind === "pickup" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}
                >
                  {nextStop.kind === "pickup" ? "Collecte" : "Livraison"}
                </span>
                <span className="font-semibold">{nextStop.label}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {nextStop.address}, {nextStop.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeLabel(nextStop.scheduledFor)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {nextStop.weightKg} kg
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="gap-2">
                  <Link to="/driver/missions/$missionId" params={{ missionId: nextStop.missionId }}>
                    Ouvrir la mission <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${nextStop.lat},${nextStop.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Naviguer
                  </a>
                </Button>
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold mb-3">Itinéraire</h3>
            <DiambarMapLazy
              markers={mapMarkers}
              routes={mapRoutes}
              center={mapCenter}
              zoom={11}
              minHeight={320}
              fitBounds
            />
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-display font-bold">Arrêts ({t.stops.length})</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    tourActions.optimize(t.id, t.stops);
                    toast.success("Tournée optimisée · trajet le plus court (distances réelles)");
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Optimiser
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" />
                  Feuille de route CSV
                </Button>
              </div>
            </div>
            <ol className="space-y-2">
              {t.stops.map((s, i) => (
                <li
                  key={s.id}
                  className={`rounded-xl border p-3 flex items-start gap-3 ${s.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}
                >
                  <button
                    onClick={() => toggleStop(s)}
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}
                    aria-label={s.done ? "Marquer non fait" : "Marquer comme fait"}
                  >
                    {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${s.kind === "pickup" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"}`}
                      >
                        {s.kind === "pickup" ? "Collecte" : "Livraison"}
                      </span>
                      <span className="text-sm font-medium truncate">{s.label}</span>
                      <span className="text-[11px] text-muted-foreground">{s.missionRef}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {s.address}, {s.city}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeLabel(s.scheduledFor)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {s.weightKg} kg
                      </span>
                      <a
                        href={`tel:${s.contactPhone}`}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        <Phone className="h-3 w-3" />
                        {s.contactPhone}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => tourActions.move(t.id, t.stops, i, -1)}
                      className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      aria-label="Monter"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => tourActions.move(t.id, t.stops, i, 1)}
                      className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      aria-label="Descendre"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-4">
          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Statut
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{STATUS_LABEL[t.status]}</div>
            <div className="mt-4 space-y-2">
              {t.status === "planned" && (
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    tourActions.start(t.stops);
                    toast.success("Tournée démarrée");
                  }}
                >
                  <Play className="h-4 w-4" />
                  Démarrer la tournée
                </Button>
              )}
              {t.status === "running" && (
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    tourActions.finish(t.stops);
                    toast.success("Tournée clôturée");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Clôturer la tournée
                </Button>
              )}
              {t.status === "done" && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Tournée terminée
                </div>
              )}
            </div>
          </div>

          {nextStop && (
            <div className="glass rounded-2xl p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Actions rapides
              </div>
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link to="/driver/incidents" search={{ missionRef: nextStop.missionRef }}>
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
              <a
                href={`tel:${nextStop.contactPhone}`}
                className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-accent transition text-xs"
              >
                <Phone className="h-3.5 w-3.5" />
                {nextStop.contactPhone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof RouteIcon;
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
