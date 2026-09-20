import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Zap, ZapOff } from "lucide-react";
import { FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { WEEKDAYS, WEEKDAY_LABEL, type WeekDay } from "@/data/mocks";
import {
  useDriverSettings,
  driverSettingsActions,
  useDriverOnline,
  driverOnlineActions,
} from "@/data/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/driver/settings/work")({
  head: () => ({ meta: [{ title: "Travail & disponibilité · Paramètres livreur" }] }),
  component: WorkSettings,
});

const URGENCY_LABEL = {
  standard: "Livraison normale",
  priority: "Prioritaire",
  express: "Express",
} as const;
const URGENCIES = Object.keys(URGENCY_LABEL) as (keyof typeof URGENCY_LABEL)[];
const CITIES = ["Dakar", "Thiès", "Mbour"];

function WorkSettings() {
  const settings = useDriverSettings();
  const online = useDriverOnline();

  const toggleUrgency = (u: string) => {
    const list = settings.criteria.acceptedUrgencies;
    driverSettingsActions.setCriteria({
      acceptedUrgencies: list.includes(u as never)
        ? list.filter((x) => x !== u)
        : [...list, u as (typeof list)[number]],
    });
  };
  const toggleCity = (c: string) => {
    const list = settings.criteria.acceptedCities;
    driverSettingsActions.setCriteria({
      acceptedCities: list.includes(c) ? list.filter((x) => x !== c) : [...list, c],
    });
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Statut actuel</div>
          <div
            className={`mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
            {online ? "Disponible" : "Hors ligne"}
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            driverOnlineActions.toggle();
            toast.success(online ? "Vous êtes hors ligne" : "Vous êtes en ligne");
          }}
        >
          {online ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
          {online ? "Passer hors ligne" : "Passer en ligne"}
        </Button>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">Acceptation des missions</h3>
        <ToggleRow
          label="Acceptation automatique"
          description="Accepter automatiquement les missions correspondant à mes critères."
          checked={settings.autoAccept}
          onChange={(v) => {
            driverSettingsActions.setWorkPrefs({ autoAccept: v });
            toast.success(
              v ? "Acceptation automatique activée" : "Acceptation automatique désactivée",
            );
          }}
        />

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Critères de missions
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Rayon d'action</span>
              <span className="font-mono font-semibold text-primary">{settings.radius} km</span>
            </div>
            <Slider
              value={[settings.radius]}
              onValueChange={([v]) => driverSettingsActions.setWorkPrefs({ radius: v })}
              min={5}
              max={200}
              step={5}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FieldRow label="Rémunération minimale (FCFA)">
              <Input
                inputMode="numeric"
                value={settings.criteria.minPayout}
                onChange={(e) =>
                  driverSettingsActions.setCriteria({
                    minPayout: Number(e.target.value.replace(/\D/g, "")) || 0,
                  })
                }
              />
            </FieldRow>
            <FieldRow label="Poids maximal (kg)">
              <Input
                inputMode="numeric"
                value={settings.criteria.maxWeightKg}
                onChange={(e) =>
                  driverSettingsActions.setCriteria({
                    maxWeightKg: Number(e.target.value.replace(/\D/g, "")) || 0,
                  })
                }
              />
            </FieldRow>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Types de missions</div>
            <div className="flex flex-wrap gap-2">
              {URGENCIES.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUrgency(u)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${settings.criteria.acceptedUrgencies.includes(u) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                >
                  {URGENCY_LABEL[u]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Zones acceptées</div>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCity(c)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${settings.criteria.acceptedCities.includes(c) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {settings.autoAccept && (
            <p className="text-xs text-muted-foreground">
              Une mission « disponible » qui respecte tous ces critères sera acceptée pour vous dès
              qu'elle apparaît.
            </p>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Horaires de travail</h3>
          <p className="text-sm text-muted-foreground mt-1">Vos disponibilités habituelles.</p>
        </div>
        <div className="space-y-2">
          {WEEKDAYS.map((day: WeekDay) => {
            const h = settings.workingHours[day];
            return (
              <div
                key={day}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                <Switch
                  checked={h.enabled}
                  onCheckedChange={(v) => driverSettingsActions.setWorkingDay(day, { enabled: v })}
                />
                <span className="w-24 text-sm font-medium">{WEEKDAY_LABEL[day]}</span>
                {h.enabled ? (
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <Input
                      type="time"
                      value={h.start}
                      onChange={(e) =>
                        driverSettingsActions.setWorkingDay(day, { start: e.target.value })
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground text-xs">→</span>
                    <Input
                      type="time"
                      value={h.end}
                      onChange={(e) =>
                        driverSettingsActions.setWorkingDay(day, { end: e.target.value })
                      }
                      className="w-28"
                    />
                  </div>
                ) : (
                  <span className="flex-1 text-right text-xs text-muted-foreground">Fermé</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
