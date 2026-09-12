import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
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
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { useTours, tourActions, type Tour } from "@/data/tours";

export const Route = createFileRoute("/driver/routes")({
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

function DriverRoutes() {
  const tours = useTours();
  const [openId, setOpenId] = useState<string | null>(tours[0]?.id ?? null);

  const exportCsv = (t: Tour) => {
    downloadCsv(
      `tournee-${t.reference}.csv`,
      ["Ordre", "Type", "Point", "Adresse", "Ville", "Créneau", "Poids (kg)", "Mission", "Fait"],
      t.stops.map((s, i) => [
        i + 1,
        s.kind === "pickup" ? "Collecte" : "Livraison",
        s.label,
        s.address,
        s.city,
        `${s.windowStart}-${s.windowEnd}`,
        s.weightKg,
        s.missionRef,
        s.done ? "Oui" : "Non",
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mes tournées" subtitle="Multi-collectes et livraisons groupées" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Tournées planifiées"
          value={String(tours.filter((t) => t.status === "planned").length)}
        />
        <Stat
          label="Arrêts restants aujourd'hui"
          value={String(
            tours
              .filter((t) => t.status !== "done")
              .reduce((s, t) => s + t.stops.filter((x) => !x.done).length, 0),
          )}
        />
        <Stat
          label="Gains prévus"
          value={formatFCFA(
            tours.filter((t) => t.status !== "done").reduce((s, t) => s + t.payout, 0),
          )}
        />
      </div>

      <div className="space-y-4">
        {tours.map((t) => {
          const open = openId === t.id;
          const done = t.stops.filter((s) => s.done).length;
          const pct = Math.round((done / t.stops.length) * 100);
          return (
            <div key={t.id} className="glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : t.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/40 transition"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <RouteIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {t.reference} · {t.stops.length} arrêts
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.date} · {t.vehicle} · {t.distanceKm} km · {formatFCFA(t.payout)}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                    t.status === "running"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : t.status === "done"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </button>

              <div className="px-4 pb-2">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {done}/{t.stops.length} arrêts validés
                </div>
              </div>

              {open && (
                <div className="p-4 pt-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        tourActions.optimize(t.id);
                        toast.success("Tournée optimisée · collectes puis livraisons par créneau");
                      }}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      Optimiser
                    </Button>
                    {t.status === "planned" && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          tourActions.start(t.id);
                          toast.success("Tournée démarrée");
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Démarrer
                      </Button>
                    )}
                    {t.status === "running" && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          tourActions.finish(t.id);
                          toast.success("Tournée clôturée");
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Clôturer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => exportCsv(t)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Feuille de route CSV
                    </Button>
                  </div>

                  <ol className="space-y-2">
                    {t.stops.map((s, i) => (
                      <li
                        key={s.id}
                        className={`rounded-xl border p-3 flex items-start gap-3 ${s.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}
                      >
                        <button
                          onClick={() => tourActions.toggleStop(t.id, s.id)}
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
                            <span className="text-[11px] text-muted-foreground">
                              {s.missionRef}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {s.address}, {s.city}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {s.windowStart} – {s.windowEnd}
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
                            onClick={() => tourActions.move(t.id, i, -1)}
                            className="grid h-6 w-6 place-items-center rounded-md hover:bg-accent text-muted-foreground"
                            aria-label="Monter"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => tourActions.move(t.id, i, 1)}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
