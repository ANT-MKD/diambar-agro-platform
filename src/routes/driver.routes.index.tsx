import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Route as RouteIcon, Wand2, Search, Plus, Clock, Wallet, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFCFA } from "@/lib/format";
import { useTours, tourActions, type Tour } from "@/data/tours";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";

export const Route = createFileRoute("/driver/routes/")({
  head: () => ({
    meta: [
      { title: "Mes tournées — Espace livreur Diambar Agro" },
      {
        name: "description",
        content:
          "Organisez vos tournées multi-collectes : ordre des arrêts, créneaux, poids transporté et gains estimés.",
      },
      { property: "og:title", content: "Mes tournées — Espace livreur" },
      {
        property: "og:description",
        content: "Tournées multi-arrêts optimisées pour vos livraisons.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverRoutes,
});

const STATUS_LABEL: Record<Tour["status"], string> = {
  planned: "Planifiée",
  running: "En cours",
  done: "Terminée",
};

const STATUS_CLASS: Record<Tour["status"], string> = {
  planned: "bg-muted text-muted-foreground",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  done: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

type StatusFilter = "all" | Tour["status"];

function DriverRoutes() {
  const tours = useTours();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const planned = tours.filter((t) => t.status === "planned");
  const running = tours.filter((t) => t.status === "running");
  const notDone = tours.filter((t) => t.status !== "done");

  // Les tournées sont regroupées par jour réel des missions : le jour le
  // plus récent sert de référence "aujourd'hui" pour comparer arrêts/gains
  // à la veille, sans inventer de delta sur les compteurs cumulés
  // (Tournées planifiées / en cours) qui n'ont pas de sens jour par jour.
  const sortedDates = Array.from(new Set(tours.map((t) => t.date))).sort((a, b) =>
    b.localeCompare(a),
  );
  const todayTour = sortedDates[0] ? tours.find((t) => t.date === sortedDates[0]) : null;
  const yesterdayTour = sortedDates[1] ? tours.find((t) => t.date === sortedDates[1]) : null;
  const stopsRemaining = (t: Tour | null | undefined) =>
    t ? t.stops.filter((s) => !s.done).length : 0;
  const stopsToday = stopsRemaining(todayTour);
  const stopsYesterday = stopsRemaining(yesterdayTour);
  const gainsToday = todayTour?.payout ?? 0;
  const gainsYesterday = yesterdayTour?.payout ?? 0;

  const items = useMemo(() => {
    return tours
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => q === "" || t.reference.toLowerCase().includes(q.toLowerCase()));
  }, [tours, status, q]);

  const optimizeAll = () => {
    notDone.forEach((t) => tourActions.optimize(t.id, t.stops));
    toast.success(`${notDone.length} tournée(s) optimisée(s)`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes tournées"
        subtitle="Organisez vos collectes et livraisons en un seul parcours."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/driver/routes/new">
                <Plus className="h-4 w-4" />
                Créer une tournée
              </Link>
            </Button>
            <Button className="gap-2" onClick={optimizeAll} disabled={notDone.length === 0}>
              <Wand2 className="h-4 w-4" />
              Optimiser mes tournées
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={RouteIcon} label="Tournées planifiées" value={String(planned.length)} />
        <Stat
          icon={Truck}
          label="Tournées en cours"
          value={String(running.length)}
          extra={running.length > 0 ? "En cours" : undefined}
        />
        <Stat
          icon={Clock}
          label="Arrêts restants"
          value={String(stopsToday)}
          extra={
            sortedDates.length > 1
              ? `${stopsToday - stopsYesterday >= 0 ? "+" : ""}${stopsToday - stopsYesterday} vs hier`
              : undefined
          }
        />
        <Stat
          icon={Wallet}
          label="Gains prévus"
          value={formatFCFA(notDone.reduce((s, t) => s + t.payout, 0))}
          extra={
            sortedDates.length > 1 && gainsYesterday !== 0
              ? `${Math.round(((gainsToday - gainsYesterday) / gainsYesterday) * 100) >= 0 ? "+" : ""}${Math.round(((gainsToday - gainsYesterday) / gainsYesterday) * 100)}% vs hier`
              : undefined
          }
        />
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une tournée…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="planned">Planifiées</SelectItem>
            <SelectItem value="running">En cours</SelectItem>
            <SelectItem value="done">Terminées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="Aucune tournée"
          description="Acceptez des missions depuis l'onglet Missions pour construire automatiquement vos tournées du jour."
        />
      ) : (
        <div className="space-y-3">
          {items.map((t) => {
            const done = t.stops.filter((s) => s.done).length;
            const pct = Math.round((done / t.stops.length) * 100);
            const markers = t.stops.map((s, i) => ({
              id: s.id,
              lat: s.lat,
              lng: s.lng,
              label: `${i + 1}`,
              color: (s.done ? "emerald" : s.kind === "pickup" ? "amber" : "blue") as
                "emerald" | "amber" | "blue",
            }));
            return (
              <div key={t.id} className="glass rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <RouteIcon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold">{t.reference}</span>
                    <span
                      className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_CLASS[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {t.stops.length} arrêts · {t.distanceKm} km · {t.date}
                  </div>
                  <div className="text-sm mt-1 truncate text-muted-foreground">
                    {t.stops.map((s) => s.label).join(" → ")}
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {done}/{t.stops.length} arrêts validés · {formatFCFA(t.payout)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/driver/routes/$tourId" params={{ tourId: t.id }}>
                        Voir détails
                      </Link>
                    </Button>
                    {t.status !== "done" && (
                      <Button asChild size="sm">
                        <Link to="/driver/routes/$tourId" params={{ tourId: t.id }}>
                          Ouvrir la tournée
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="sm:w-52 shrink-0">
                  <DiambarMapLazy markers={markers} minHeight={140} zoom={10} fitBounds />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  extra,
}: {
  icon: typeof RouteIcon;
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      {extra && <div className="text-[11px] text-muted-foreground mt-0.5">{extra}</div>}
    </div>
  );
}
