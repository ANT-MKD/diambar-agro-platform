import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Truck,
  Wallet,
  Route as RouteIcon,
  Star,
  Zap,
  ArrowRight,
  Clock,
  MapPin,
  TrendingUp,
  Package,
  ZapOff,
  Navigation,
  TriangleAlert,
  Car,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import {
  useDriverMissions,
  useDriverOnline,
  driverOnlineActions,
  useDriverWallet,
  useDriverVehicle,
  useVehicleIssues,
  useDriverSettings,
  useMyDriverFleet,
  useMyMissionEligibility,
  missionActions,
} from "@/data/store";
import { missionEligibility } from "@/lib/mission-eligibility";
import { useIncidents, INCIDENT_TYPE_LABEL } from "@/data/business";
import { useSecurity } from "@/data/security";
import { driverProfile, restaurants, farmers, type Mission } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { ProfileCompletion } from "@/components/common/profile-completion";
import { driverCompletionItems } from "@/lib/profile-completion";
import {
  dayKey,
  timeLabel,
  daysUntil,
  referenceDay,
  gainsForDay,
  MISSION_BADGE,
} from "@/lib/driver-day";
import { Button } from "@/components/ui/button";
import { LiveTrackingMapLazy } from "@/components/maps/live-tracking-map-lazy";

export const Route = createFileRoute("/driver/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord · Livreur Diambar" }] }),
  component: DriverDashboard,
});

function ProgressRing({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-primary transition-all"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-xl font-bold">{pct}%</span>
      </div>
    </div>
  );
}

function DriverDashboard() {
  const missions = useDriverMissions();
  const online = useDriverOnline();
  const wallet = useDriverWallet();
  const vehicle = useDriverVehicle();
  const fleet = useMyDriverFleet();
  const eligibilityFor = useMyMissionEligibility();
  const vehicleIssues = useVehicleIssues();
  const incidents = useIncidents();
  const driverSettings = useDriverSettings();
  const security = useSecurity();

  const grossMissions = wallet.transactions
    .filter((t) => t.kind === "mission")
    .reduce((s, t) => s + t.amount, 0);
  const bonusTotal = wallet.transactions
    .filter((t) => t.kind === "bonus")
    .reduce((s, t) => s + t.amount, 0);
  const commissionTotal = wallet.transactions
    .filter((t) => t.kind === "commission")
    .reduce((s, t) => s + t.amount, 0);
  const commissionRate = grossMissions
    ? Math.round((Math.abs(commissionTotal) / grossMissions) * 1000) / 10
    : 0;
  const available = missions.filter((m) => m.status === "available");
  const active = missions.filter(
    (m) =>
      m.driverId === "d1" &&
      (m.status === "accepted" || m.status === "pickup" || m.status === "loaded"),
  );
  const nextMission = active[0] ?? null;
  const delivered = missions.filter((m) => m.driverId === "d1" && m.status === "delivered");
  const totalDistance = delivered.reduce((s, m) => s + m.distanceKm, 0);

  // Les missions de démo sont figées dans le passé : on ancre "aujourd'hui"
  // sur le jour de la dernière mission réellement assignée au livreur.
  const { today, yesterday } = useMemo(() => referenceDay(missions), [missions]);

  const todaysMissions = missions.filter(
    (m) => m.driverId === "d1" && dayKey(m.scheduledFor) === today,
  );
  const yesterdaysMissions = missions.filter(
    (m) => m.driverId === "d1" && dayKey(m.scheduledFor) === yesterday,
  );
  const deliveredToday = todaysMissions.filter((m) => m.status === "delivered");
  const remainingToday = todaysMissions.filter(
    (m) => m.status !== "delivered" && m.status !== "cancelled",
  );
  const missionsDelta = todaysMissions.length - yesterdaysMissions.length;
  const pickedUpToday = todaysMissions.filter(
    (m) => m.status === "loaded" || m.status === "delivered",
  ).length;
  const progressPct =
    todaysMissions.length > 0
      ? Math.round((deliveredToday.length / todaysMissions.length) * 100)
      : 0;
  const distanceToday = deliveredToday.reduce((s, m) => s + m.distanceKm, 0);

  const gainsToday = gainsForDay(wallet.transactions, today);
  const gainsYesterday = gainsForDay(wallet.transactions, yesterday);
  const gainsDeltaPct =
    gainsYesterday !== 0
      ? Math.round(((gainsToday - gainsYesterday) / Math.abs(gainsYesterday)) * 100)
      : null;

  const firstToday =
    todaysMissions.length > 0
      ? todaysMissions.reduce((a, b) => (a.scheduledFor < b.scheduledFor ? a : b))
      : null;
  const lastToday =
    todaysMissions.length > 0
      ? todaysMissions.reduce((a, b) => (a.scheduledFor > b.scheduledFor ? a : b))
      : null;
  const tourEnded = todaysMissions.length > 0 && deliveredToday.length === todaysMissions.length;
  const endTime = lastToday
    ? timeLabel(
        new Date(
          new Date(lastToday.scheduledFor).getTime() + lastToday.estimatedMinutes * 60000,
        ).toISOString(),
      )
    : null;

  const todaysBoard = useMemo(
    () =>
      missions
        .filter(
          (m) =>
            m.status !== "cancelled" &&
            dayKey(m.scheduledFor) === today &&
            (m.driverId === "d1" || m.status === "available"),
        )
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    [missions, today],
  );

  const openIncidents = incidents.filter((i) => i.status !== "resolved").slice(0, 2);
  const lastPayment = wallet.transactions.find((t) => t.kind === "mission" || t.kind === "bonus");

  const hasOpenVehicleIssue = vehicleIssues.some((i) => i.status === "reported");
  const insuranceSoon = daysUntil(vehicle.insuranceExpiry) <= 30;
  const inspectionSoon = daysUntil(vehicle.inspectionExpiry) <= 30;
  const vehicleOk = !hasOpenVehicleIssue && !insuranceSoon && !inspectionSoon;

  const kpis = [
    {
      label: "Gains (missions livrées)",
      value: formatFCFA(grossMissions + bonusTotal),
      icon: Wallet,
      tone: "from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Livraisons",
      value: `${delivered.length}`,
      icon: Truck,
      tone: "from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Distance",
      value: `${totalDistance} km`,
      icon: RouteIcon,
      tone: "from-violet-500/20 to-violet-500/0 border-violet-500/30 text-violet-600 dark:text-violet-400",
    },
    {
      label: "Note client",
      value: `${driverProfile.rating} ★`,
      icon: Star,
      tone: "from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-600 dark:text-amber-400",
    },
  ];

  // Peu de jours couverts par les missions de démo : agrégation par jour réel
  // plutôt qu'une semaine simulée.
  const earningsByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of wallet.transactions) {
      if (t.kind !== "mission" && t.kind !== "bonus") continue;
      const day = t.at.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + t.amount);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, amount]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        amount,
      }));
  }, [wallet.transactions]);
  const maxChart = Math.max(1, ...earningsByDay.map((d) => d.amount));
  const weekTotal = earningsByDay.reduce((s, d) => s + d.amount, 0);

  const nextTarget = (m: Mission) =>
    m.status === "loaded"
      ? { label: "Livraison", ...m.dropoff }
      : { label: "Collecte", ...m.pickup };

  const acceptMission = (id: string, ref: string) => {
    const result = missionActions.accept(id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Mission ${ref} acceptée`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${driverProfile.name.split(" ")[0]} 👋`}
        subtitle={`${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · ${
          online
            ? "Vous êtes en ligne · les missions vous seront proposées en temps réel"
            : "Vous êtes hors-ligne · aucune mission ne vous sera proposée"
        }`}
        actions={
          <Button
            variant={online ? "outline" : "default"}
            onClick={() => driverOnlineActions.toggle()}
            className="gap-2"
          >
            {online ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
            {online ? "Passer hors-ligne" : "Se mettre en ligne"}
          </Button>
        }
      />

      <ProfileCompletion
        title="Profil livreur complété"
        items={driverCompletionItems(driverSettings, driverProfile.documents, security.twoFa)}
      />

      {/* KPIs du jour */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-blue-500/20 to-blue-500/0 border-blue-500/30 text-blue-600 dark:text-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Missions aujourd'hui</span>
            <Truck className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{todaysMissions.length}</div>
          {yesterdaysMissions.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {missionsDelta >= 0 ? "+" : ""}
              {missionsDelta} vs hier
            </div>
          )}
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-amber-500/20 to-amber-500/0 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Missions restantes</span>
            <Clock className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{remainingToday.length}</div>
          <div className="text-[11px] text-muted-foreground">À effectuer</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 bg-gradient-to-br from-emerald-500/20 to-emerald-500/0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Terminées</span>
            <CheckCircle2 className="h-4 w-4 opacity-80" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">
            {deliveredToday.length} / {todaysMissions.length}
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
          </div>
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Prochaine mission */}
        <div className="lg:col-span-2 space-y-6">
          {nextMission ? (
            (() => {
              const r = restaurants.find((x) => x.id === nextMission.restaurantId);
              const f = farmers.find((x) => x.id === nextMission.farmerId);
              const target = nextTarget(nextMission);
              const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}`;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl overflow-hidden border-l-4 border-primary"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Mission en cours
                        </div>
                        <div className="font-display text-xl font-bold mt-1">
                          {nextMission.reference}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${MISSION_BADGE[nextMission.status].className}`}
                      >
                        <Clock className="h-3 w-3" />
                        {MISSION_BADGE[nextMission.status].label}
                      </span>
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-muted/40 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase">
                          <MapPin className="h-3.5 w-3.5" /> Pickup · {f?.farm}
                        </div>
                        <div className="mt-1 text-sm">{nextMission.pickup.address}</div>
                      </div>
                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase">
                          <MapPin className="h-3.5 w-3.5" /> Livraison · {r?.name}
                        </div>
                        <div className="mt-1 text-sm">{nextMission.dropoff.address}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <RouteIcon className="h-3.5 w-3.5" />
                        {nextMission.distanceKm} km
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />~ {nextMission.estimatedMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {nextMission.weightKg} kg
                      </span>
                      <span className="ml-auto font-bold text-primary text-base">
                        {formatFCFA(nextMission.payout)}
                      </span>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button asChild variant="outline" className="gap-2">
                        <a href={navUrl} target="_blank" rel="noopener noreferrer">
                          <Navigation className="h-4 w-4" />
                          Démarrer la navigation
                        </a>
                      </Button>
                      <Button asChild className="flex-1 gap-2">
                        <Link
                          to="/driver/missions/$missionId"
                          params={{ missionId: nextMission.id }}
                        >
                          Ouvrir la mission <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })()
          ) : (
            <div className="glass rounded-2xl p-10 text-center">
              <Truck className="h-10 w-10 mx-auto text-muted-foreground" />
              <h3 className="mt-3 font-semibold">Aucune mission en cours</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Parcourez le marketplace pour accepter votre prochaine mission.
              </p>
              <Button asChild className="mt-4 gap-2">
                <Link to="/driver/missions">
                  Voir les missions <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          {/* Progression de la journée */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold mb-4">Progression de la journée</h3>
            <div className="flex flex-wrap items-center gap-6">
              <ProgressRing pct={progressPct} />
              <div className="flex-1 min-w-[220px] space-y-3">
                <div className="text-sm">
                  <span className="font-bold">{deliveredToday.length}</span> missions terminées sur{" "}
                  <span className="font-bold">{todaysMissions.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Distance parcourue</div>
                    <div className="font-semibold">{distanceToday} km</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Missions du jour</div>
                    <div className="font-semibold">{todaysMissions.length}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  label: "Départ",
                  done: !!firstToday,
                  detail: firstToday ? timeLabel(firstToday.scheduledFor) : "—",
                },
                {
                  label: "Collectes",
                  done: todaysMissions.length > 0 && pickedUpToday === todaysMissions.length,
                  detail: `${pickedUpToday}/${todaysMissions.length}`,
                },
                {
                  label: "Livraisons",
                  done:
                    todaysMissions.length > 0 && deliveredToday.length === todaysMissions.length,
                  detail: `${deliveredToday.length}/${todaysMissions.length}`,
                },
                {
                  label: "Fin de tournée",
                  done: tourEnded,
                  detail: tourEnded ? "Terminée" : (endTime ?? "—"),
                },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border p-2.5 text-center">
                  {s.done ? (
                    <CheckCircle2 className="h-4 w-4 mx-auto text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 mx-auto text-muted-foreground" />
                  )}
                  <div className="mt-1 text-[11px] font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ma tournée */}
          {nextMission && (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold">Ma tournée</h3>
                <Link
                  to="/driver/routes"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Voir toute la tournée <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <LiveTrackingMapLazy
                trackingId={nextMission.reference}
                driverName="Vous"
                minHeight={240}
                autoStart={nextMission.status === "pickup" || nextMission.status === "loaded"}
              />
            </div>
          )}

          {/* Missions du jour */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold">Missions du jour</h3>
                <p className="text-xs text-muted-foreground">
                  {todaysBoard.length} mission(s) prévue(s)
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to="/driver/missions">
                  Toutes <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {todaysBoard.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune mission prévue aujourd'hui.</p>
              )}
              {todaysBoard.map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const f = farmers.find((x) => x.id === m.farmerId);
                const badge = MISSION_BADGE[m.status];
                const eligibility = eligibilityFor(m);
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{m.reference}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {f?.farm} → {r?.name} · {timeLabel(m.scheduledFor)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatFCFA(m.payout)}</div>
                    </div>
                    {m.status === "available" ? (
                      <Button
                        size="sm"
                        disabled={!eligibility.ok}
                        title={eligibility.ok ? undefined : eligibility.message}
                        onClick={() => acceptMission(m.id, m.reference)}
                      >
                        Prendre la mission
                      </Button>
                    ) : m.status === "delivered" ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/driver/missions/$missionId" params={{ missionId: m.id }}>
                          Voir détails
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm">
                        <Link to="/driver/missions/$missionId" params={{ missionId: m.id }}>
                          Navigation
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Missions disponibles */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold">Missions disponibles</h3>
                <p className="text-xs text-muted-foreground">
                  {available.length} mission(s) autour de vous
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to="/driver/missions">
                  Toutes <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {available.slice(0, 3).map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                return (
                  <Link
                    key={m.id}
                    to="/driver/missions/$missionId"
                    params={{ missionId: m.id }}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent/40 transition"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {m.pickup.city} → {m.dropoff.city}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {r?.name} · {m.distanceKm} km · {m.weightKg} kg
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatFCFA(m.payout)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {relativeTime(m.createdAt)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar droite */}
        <div className="space-y-6">
          {/* Alertes & incidents */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-destructive" />
                Alertes & incidents
              </h3>
              <Link to="/driver/incidents" className="text-xs text-primary hover:underline">
                Voir tout
              </Link>
            </div>
            <div className="space-y-2">
              {openIncidents.map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                >
                  <div className="font-semibold text-amber-700 dark:text-amber-400">
                    {INCIDENT_TYPE_LABEL[i.type]}
                  </div>
                  <div className="text-muted-foreground">
                    {i.missionRef} · {relativeTime(i.createdAt)}
                  </div>
                </div>
              ))}
              {lastPayment && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Paiement reçu
                  </div>
                  <div className="text-muted-foreground">
                    + {formatFCFA(lastPayment.amount)} · {relativeTime(lastPayment.at)}
                  </div>
                </div>
              )}
              {openIncidents.length === 0 && !lastPayment && (
                <p className="text-xs text-muted-foreground">Aucune alerte pour le moment.</p>
              )}
            </div>
          </div>

          {/* Portefeuille */}
          <div className="glass rounded-2xl p-5 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Portefeuille
              </div>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">
              {formatFCFA(wallet.balance)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              disponible · {formatFCFA(wallet.pending)} en attente
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Dernières transactions
              </div>
              {wallet.transactions.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{t.label}</span>
                  <span
                    className={`font-semibold shrink-0 ${t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}
                  >
                    {t.amount > 0 ? "+" : "−"}
                    {formatFCFA(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-border p-3 text-xs space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Commission
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gains bruts</span>
                <span className="font-medium">{formatFCFA(grossMissions)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diambar ({commissionRate}%)</span>
                <span className="font-medium text-rose-500">
                  − {formatFCFA(Math.abs(commissionTotal))}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">Net</span>
                <span className="font-bold text-primary">
                  {formatFCFA(grossMissions + bonusTotal + commissionTotal)}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <Button asChild size="sm" className="w-full">
                <Link to="/driver/wallet">Voir le portefeuille</Link>
              </Button>
            </div>
          </div>

          {/* Graph gains */}
          {earningsByDay.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Mes revenus
                  </div>
                  <div className="mt-1 font-display font-bold flex items-center gap-1.5">
                    {formatFCFA(weekTotal)} <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatFCFA(gainsToday)} aujourd'hui
                  </div>
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-24">
                {earningsByDay.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-primary to-primary/40"
                        style={{ height: `${(d.amount / maxChart) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* État du véhicule */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold flex items-center gap-2">
                <Car className="h-4 w-4" />
                État du véhicule
              </h3>
              <Link to="/driver/vehicle" className="text-xs text-primary hover:underline">
                Voir les détails
              </Link>
            </div>
            <div className="text-sm font-semibold">
              {vehicle.brand} {vehicle.model}
            </div>
            <div className="text-xs text-muted-foreground font-mono">{vehicle.plate}</div>
            <span
              className={`inline-flex mt-2 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${vehicleOk ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
            >
              {vehicleOk ? <ShieldCheck className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
              {vehicleOk ? "Bon état" : "À vérifier"}
            </span>
            <div className="mt-3 text-xs text-muted-foreground">
              {vehicle.nextMaintenanceAt
                ? `Prochaine maintenance dans ${daysUntil(vehicle.nextMaintenanceAt)} jour(s)`
                : "Aucune maintenance programmée"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
