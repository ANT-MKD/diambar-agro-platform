import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, MapPin, Clock, Package, User, X } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { LiveTrackingMapLazy } from "@/components/maps/live-tracking-map-lazy";
import { useMissions } from "@/data/store";
import { drivers, farmers, restaurants, type MissionStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/deliveries")({
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

function AdminDeliveries() {
  const missions = useMissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useMemo(
    () => missions.filter((m) => ACTIVE_STATUSES.includes(m.status)),
    [missions],
  );
  const unassigned = missions.filter((m) => m.status === "available").length;
  const activeDrivers = new Set(active.map((m) => m.driverId).filter(Boolean)).size;
  const totalDistanceToday = active.reduce((s, m) => s + m.distanceKm, 0);

  const selected = active.find((m) => m.id === selectedId) ?? null;
  const selectedDriver = selected ? drivers.find((d) => d.id === selected.driverId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livraisons"
        subtitle="Vue globale des courses en cours, tous livreurs confondus"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Livraisons actives" value={String(active.length)} icon={Truck} />
        <StatCard label="Livreurs en mission" value={String(activeDrivers)} icon={User} />
        <StatCard
          label="Distance cumulée"
          value={`${totalDistanceToday} km`}
          icon={MapPin}
          hint="Missions actives"
        />
        <StatCard
          label="Non assignées"
          value={String(unassigned)}
          icon={Package}
          hint="En attente d'un livreur"
        />
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

      {active.length === 0 ? (
        <EmptyState icon={Truck} title="Aucune livraison active" description="Tout est livré." />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Mission</th>
                <th className="text-left p-3">Trajet</th>
                <th className="text-left p-3">Livreur</th>
                <th className="text-left p-3">Statut</th>
                <th className="text-right p-3">ETA</th>
                <th className="text-right p-3" />
              </tr>
            </thead>
            <tbody>
              {active.map((m) => {
                const f = farmers.find((x) => x.id === m.farmerId);
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const d = drivers.find((x) => x.id === m.driverId);
                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)}
                    className={`border-t border-border hover:bg-accent/30 cursor-pointer ${m.id === selectedId ? "bg-accent/40" : ""}`}
                  >
                    <td className="p-3">
                      <div className="font-medium">{m.reference}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {f?.farm} → {r?.name}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {m.pickup.city} → {m.dropoff.city}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <img src={d?.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                        {d?.name ?? "—"}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[m.status]}`}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {relativeTime(m.scheduledFor)}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
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
