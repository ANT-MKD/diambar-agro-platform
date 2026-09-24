import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Package,
  Search,
  Zap,
  Check,
  X,
  Wallet,
  CheckCircle2,
  ArrowUpDown,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import {
  useMissions,
  missionActions,
  useDriverWallet,
  useDriverOnline,
  driverOnlineActions,
  useMyDriverFleet,
} from "@/data/store";
import { restaurants, farmers, type Mission } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { missionEligibility } from "@/lib/mission-eligibility";
import { dayKey, timeLabel, referenceDay, gainsForDay, MISSION_BADGE } from "@/lib/driver-day";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";

export const Route = createFileRoute("/driver/missions/")({
  head: () => ({ meta: [{ title: "Missions · Livreur Diambar" }] }),
  component: MissionsPage,
});

const URGENCY_TONE = {
  standard: "bg-muted text-muted-foreground border-border",
  priority: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  express: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
} as const;

type Tab = "all" | "available" | "active" | "delivered" | "cancelled";
type Sort = "recent" | "distance";

function matchesTab(m: Mission, tab: Tab) {
  if (tab === "all") return true;
  if (tab === "available") return m.status === "available";
  if (tab === "active")
    return m.driverId === "d1" && ["accepted", "pickup", "loaded"].includes(m.status);
  if (tab === "delivered") return m.driverId === "d1" && m.status === "delivered";
  return m.status === "cancelled";
}

function MissionsPage() {
  const all = useMissions();
  const wallet = useDriverWallet();
  const online = useDriverOnline();
  const fleet = useMyDriverFleet();
  const [tab, setTab] = useState<Tab>("available");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("all");
  const [sort, setSort] = useState<Sort>("recent");

  const { today, yesterday } = useMemo(() => referenceDay(all), [all]);

  const available = all.filter((m) => m.status === "available");
  const availableToday = available.filter((m) => dayKey(m.createdAt) === today).length;
  const active = all.filter(
    (m) => m.driverId === "d1" && ["accepted", "pickup", "loaded"].includes(m.status),
  );
  const deliveredToday = all.filter(
    (m) => m.driverId === "d1" && m.status === "delivered" && dayKey(m.scheduledFor) === today,
  );
  const gainsToday = gainsForDay(wallet.transactions, today);
  const gainsYesterday = gainsForDay(wallet.transactions, yesterday);
  const gainsDeltaPct =
    gainsYesterday !== 0
      ? Math.round(((gainsToday - gainsYesterday) / Math.abs(gainsYesterday)) * 100)
      : null;

  const items = useMemo(() => {
    const filtered = all
      .filter((m) => matchesTab(m, tab))
      .filter(
        (m) =>
          q === "" ||
          m.reference.toLowerCase().includes(q.toLowerCase()) ||
          m.pickup.city.toLowerCase().includes(q.toLowerCase()) ||
          m.dropoff.city.toLowerCase().includes(q.toLowerCase()),
      )
      .filter((m) => city === "all" || m.pickup.city === city || m.dropoff.city === city);
    const sorted = [...filtered].sort((a, b) =>
      sort === "distance"
        ? a.distanceKm - b.distanceKm
        : b.scheduledFor.localeCompare(a.scheduledFor),
    );
    // Les missions que ce véhicule peut réellement prendre passent devant ;
    // les autres restent visibles (grisées) pour que le livreur sache pourquoi.
    const takeable = (m: Mission) =>
      m.status !== "available" || missionEligibility(m, fleet).ok ? 0 : 1;
    return sorted.sort((a, b) => takeable(a) - takeable(b));
  }, [all, tab, q, city, sort, fleet]);

  const cities = Array.from(new Set(all.flatMap((m) => [m.pickup.city, m.dropoff.city])));

  const accept = (id: string, ref: string) => {
    const result = missionActions.accept(id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Mission ${ref} acceptée`);
  };
  const refuse = (id: string, ref: string) => {
    missionActions.cancel(id);
    toast.success(`Mission ${ref} refusée`);
  };

  const count = (t: Tab) => all.filter((m) => matchesTab(m, t)).length;

  const mapMarkers = useMemo(
    () =>
      available.slice(0, 6).map((m) => ({
        id: m.id,
        lat: m.pickup.lat,
        lng: m.pickup.lng,
        label: m.reference,
        color: "blue" as const,
        description: `${formatFCFA(m.payout)} · ${m.pickup.city} → ${m.dropoff.city}`,
      })),
    [available],
  );
  const mapCenter: [number, number] | undefined =
    mapMarkers.length > 0 ? [mapMarkers[0].lat, mapMarkers[0].lng] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Missions" subtitle="Trouvez et gérez vos missions de livraison" />

      {fleet.status === "blocked" && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          <strong>Véhicule non conforme.</strong> Votre assurance ou votre contrôle technique est
          expiré : vous ne pouvez plus accepter de mission tant que ce n'est pas régularisé.{" "}
          <Link to="/driver/vehicle" className="font-semibold underline">
            Mettre à jour mes documents
          </Link>
        </div>
      )}

      {/* KPIs du jour */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-600 dark:text-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Missions disponibles</span>
            <Truck className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{available.length}</div>
          {availableToday > 0 && (
            <div className="text-[11px] text-muted-foreground">+{availableToday} aujourd'hui</div>
          )}
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Missions en cours</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{active.length}</div>
          <div className="text-[11px] text-muted-foreground">À traiter</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Missions terminées</span>
            <CheckCircle2 className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{deliveredToday.length}</div>
          <div className="text-[11px] text-muted-foreground">Aujourd'hui</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-violet-500/20 to-violet-500/0 border-violet-500/30 text-violet-600 dark:text-violet-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Gains du jour</span>
            <Wallet className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{formatFCFA(gainsToday)}</div>
          {gainsDeltaPct !== null && (
            <div className="text-[11px] text-muted-foreground">
              {gainsDeltaPct >= 0 ? "+" : ""}
              {gainsDeltaPct}% vs hier
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Toutes ({count("all")})</TabsTrigger>
              <TabsTrigger value="available">Disponibles ({count("available")})</TabsTrigger>
              <TabsTrigger value="active">En cours ({count("active")})</TabsTrigger>
              <TabsTrigger value="delivered">Terminées ({count("delivered")})</TabsTrigger>
              <TabsTrigger value="cancelled">Annulées ({count("cancelled")})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Référence, ville…"
                className="pl-9"
              />
            </div>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes villes</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="w-[190px] gap-2">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récentes</SelectItem>
                <SelectItem value="distance">Plus courte distance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Aucune mission"
              description="Aucune mission ne correspond à vos filtres."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const f = farmers.find((x) => x.id === m.farmerId);
                const badge = MISSION_BADGE[m.status];
                const windowEnd = new Date(
                  new Date(m.scheduledFor).getTime() + m.estimatedMinutes * 60000,
                ).toISOString();
                const eligibility =
                  m.status === "available" ? missionEligibility(m, fleet) : ({ ok: true } as const);
                return (
                  <div
                    key={m.id}
                    className={`glass rounded-2xl p-4 space-y-3 flex flex-col ${eligibility.ok ? "" : "opacity-60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{m.reference}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${URGENCY_TONE[m.urgency]}`}
                          >
                            {m.urgency === "express" && <Zap className="h-2.5 w-2.5" />}
                            {m.urgency}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{m.orderRef}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-primary">
                          {formatFCFA(m.payout)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {f?.farm} → {r?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {m.distanceKm} km
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />~ {m.estimatedMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {m.weightKg} kg
                        </span>
                        {m.weightKg > fleet.capacityKg && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Véhicule incompatible
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        {timeLabel(m.scheduledFor)} - {timeLabel(windowEnd)} ·{" "}
                        {relativeTime(m.scheduledFor)}
                      </div>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to="/driver/missions/$missionId" params={{ missionId: m.id }}>
                          Voir détails
                        </Link>
                      </Button>
                      {m.status === "available" && (
                        <>
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            disabled={!eligibility.ok}
                            onClick={() => accept(m.id, m.reference)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Accepter
                          </Button>
                        </>
                      )}
                    </div>
                    {!eligibility.ok && (
                      <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        {eligibility.message}
                      </p>
                    )}
                    {m.status === "available" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:text-rose-600 -mt-1"
                        onClick={() => refuse(m.id, m.reference)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Refuser
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar droite */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold">Missions proches de vous</h3>
            </div>
            {mapMarkers.length > 0 ? (
              <DiambarMapLazy
                markers={mapMarkers}
                center={mapCenter}
                zoom={mapMarkers.length > 1 ? 9 : 12}
                minHeight={220}
                fitBounds
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Aucune mission disponible pour le moment.
              </p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Statut de connexion
              </div>
              <div className="mt-1 font-semibold flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
                />
                {online ? "En ligne" : "Hors-ligne"}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {online ? "Vous recevez les missions" : "Aucune mission ne vous sera proposée"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => driverOnlineActions.toggle()}>
              {online ? "Passer hors-ligne" : "Se mettre en ligne"}
            </Button>
          </div>

          <div className="glass rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 to-transparent">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Roulez en sécurité
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Respectez le code de la route et portez votre équipement de protection à chaque
              trajet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
