import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Package,
  User,
  X,
  Search,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { LiveTrackingMapLazy } from "@/components/maps/live-tracking-map-lazy";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMissions } from "@/data/store";
import { useIncidents } from "@/data/business";
import { drivers, farmers, restaurants, type MissionStatus, type Mission } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/deliveries/")({
  head: () => ({
    meta: [
      { title: "Livraisons — Administration Diambar Agro" },
      {
        name: "description",
        content: "Vue globale des livraisons en cours, tous livreurs confondus, avec suivi GPS.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDeliveries,
});

const ACTIVE_STATUSES: MissionStatus[] = ["accepted", "pickup", "loaded"];

const STATUS_LABEL: Record<MissionStatus, string> = {
  available: "Non assignée",
  accepted: "Acceptée",
  pickup: "Collecte en cours",
  loaded: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const STATUS_TONE: Record<MissionStatus, string> = {
  available: "bg-muted text-muted-foreground border-border",
  accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  pickup: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  loaded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

// Retard réel = heure de collecte prévue + durée estimée déjà dépassée pour
// une course pas encore livrée — pas un statut inventé. "Maintenant" s'ancre
// sur la course active la plus récemment programmée (les données de démo
// sont figées dans le passé), même principe que referenceDay côté livreur.
function isLate(m: Mission, refNow: number) {
  if (!ACTIVE_STATUSES.includes(m.status)) return false;
  return refNow > new Date(m.scheduledFor).getTime() + m.estimatedMinutes * 60_000;
}

function AdminDeliveries() {
  const missions = useMissions();
  const incidents = useIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState<"all" | MissionStatus>("all");

  const refNow = useMemo(() => {
    const relevant = missions.filter((m) => m.status !== "available" && m.status !== "cancelled");
    if (relevant.length === 0) return Date.now();
    return relevant.reduce((a, m) => Math.max(a, new Date(m.scheduledFor).getTime()), 0);
  }, [missions]);

  const active = useMemo(
    () => missions.filter((m) => ACTIVE_STATUSES.includes(m.status)),
    [missions],
  );
  const pickup = active.filter((m) => m.status === "accepted" || m.status === "pickup");
  const delivering = active.filter((m) => m.status === "loaded");
  const late = active.filter((m) => isLate(m, refNow));
  const unassigned = missions.filter((m) => m.status === "available");
  const deliveredToday = missions.filter(
    (m) => m.status === "delivered" && new Date(m.scheduledFor).getTime() > refNow - 86_400_000,
  ).length;
  const openIncidentRefs = new Set(
    incidents.filter((i) => i.status !== "resolved").map((i) => i.missionRef),
  );
  const withIncident = active.filter((m) => openIncidentRefs.has(m.reference));

  const zones = useMemo(() => Array.from(new Set(missions.map((m) => m.dropoff.city))), [missions]);

  const rows = useMemo(() => {
    return missions
      .filter((m) => m.status !== "cancelled")
      .filter((m) => (status === "all" ? true : m.status === status))
      .filter((m) => (zone === "all" ? true : m.dropoff.city === zone))
      .filter((m) => {
        if (!q) return true;
        const f = farmers.find((x) => x.id === m.farmerId);
        const r = restaurants.find((x) => x.id === m.restaurantId);
        const d = drivers.find((x) => x.id === m.driverId);
        const haystack =
          `${m.reference} ${m.orderRef} ${f?.farm ?? ""} ${r?.name ?? ""} ${d?.name ?? ""}`.toLowerCase();
        return haystack.includes(q.toLowerCase());
      })
      .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
  }, [missions, status, zone, q]);

  const selected = active.find((m) => m.id === selectedId) ?? null;
  const selectedDriver = selected ? drivers.find((d) => d.id === selected.driverId) : null;

  const alerts = [
    late.length > 0 && {
      icon: TriangleAlert,
      tone: "rose" as const,
      label: `${late.length} livraison(s) en retard`,
      onClick: () => setStatus("all"),
    },
    unassigned.length > 0 && {
      icon: Package,
      tone: "amber" as const,
      label: `${unassigned.length} course(s) sans livreur`,
      onClick: () => setStatus("available"),
    },
    withIncident.length > 0 && {
      icon: TriangleAlert,
      tone: "rose" as const,
      label: `${withIncident.length} livraison(s) avec incident ouvert`,
      to: "/admin/incidents",
    },
  ].filter(Boolean) as {
    icon: typeof TriangleAlert;
    tone: "rose" | "amber";
    label: string;
    onClick?: () => void;
    to?: string;
  }[];

  return (
    <div className="space-y-6">
      <PageHeader title="Livraisons" subtitle="Supervisez toutes les courses de la plateforme" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Courses actives" value={String(active.length)} icon={Truck} />
        <StatCard label="À récupérer" value={String(pickup.length)} icon={Package} />
        <StatCard label="En livraison" value={String(delivering.length)} icon={Truck} />
        <StatCard
          label="Livrées"
          value={String(deliveredToday)}
          icon={CheckCircle2}
          hint="Récemment"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="En retard"
          value={String(late.length)}
          icon={TriangleAlert}
          hint={late.length > 0 ? "Attention" : undefined}
        />
        <StatCard
          label="Non affectées"
          value={String(unassigned.length)}
          icon={Package}
          hint={unassigned.length > 0 ? "Attention" : undefined}
        />
        <StatCard
          label="Livreurs mobilisés"
          value={String(new Set(active.map((m) => m.driverId).filter(Boolean)).size)}
          icon={User}
        />
      </div>

      {alerts.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Courses nécessitant une intervention
          </div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) =>
              a.to ? (
                <Link
                  key={i}
                  to={a.to}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 ${a.tone === "rose" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                >
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                </Link>
              ) : (
                <button
                  key={i}
                  onClick={a.onClick}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 ${a.tone === "rose" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
                >
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Course, commande, livreur…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="available">Non affectée</SelectItem>
            <SelectItem value="accepted">Acceptée</SelectItem>
            <SelectItem value="pickup">Collecte en cours</SelectItem>
            <SelectItem value="loaded">En livraison</SelectItem>
            <SelectItem value="delivered">Livrée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && selectedDriver && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">
                {selected.reference} · {selectedDriver.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {selected.pickup.city} → {selected.dropoff.city}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
              aria-label="Fermer le suivi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <LiveTrackingMapLazy
            trackingId={selected.reference}
            driverName={selectedDriver.name}
            minHeight={340}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucune course"
          description="Aucune course ne correspond à ces filtres."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Course</th>
                <th className="text-left p-3">Trajet</th>
                <th className="text-left p-3">Livreur</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">ETA</th>
                <th className="text-right p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const f = farmers.find((x) => x.id === m.farmerId);
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const d = drivers.find((x) => x.id === m.driverId);
                const late_ = isLate(m, refNow);
                return (
                  <tr
                    key={m.id}
                    className="border-t border-border hover:bg-accent/30 cursor-pointer"
                  >
                    <td className="p-3">
                      <Link
                        to="/admin/deliveries/$missionId"
                        params={{ missionId: m.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {m.reference}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {f?.farm} → {r?.name}
                      </div>
                    </td>
                    <td
                      className="p-3 text-xs"
                      onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {m.pickup.city} → {m.dropoff.city}
                      </span>
                    </td>
                    <td
                      className="p-3 text-xs"
                      onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    >
                      <div className="flex items-center gap-2">
                        <img src={d?.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        {d?.name ?? "—"}
                      </div>
                    </td>
                    <td
                      className="p-3"
                      onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    >
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${late_ ? STATUS_TONE.cancelled : STATUS_TONE[m.status]}`}
                      >
                        {late_ ? "En retard" : STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td
                      className="p-3 text-right text-xs text-muted-foreground"
                      onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {relativeTime(m.scheduledFor)}
                      </span>
                    </td>
                    <td
                      className="p-3 text-right font-semibold text-primary"
                      onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    >
                      {formatFCFA(m.payout)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
