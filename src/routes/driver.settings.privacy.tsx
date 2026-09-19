import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { MapPin, Check } from "lucide-react";
import { ToggleRow } from "@/components/common/settings-shell";
import { useDriverSettings, driverSettingsActions } from "@/data/store";

export const Route = createFileRoute("/driver/settings/privacy")({
  head: () => ({ meta: [{ title: "Confidentialité · Paramètres livreur" }] }),
  component: PrivacySettings,
});

const USES = [
  "Navigation vers le point de collecte ou de livraison",
  "Suivi de mission en temps réel pour le restaurant",
  "Estimation de l'heure d'arrivée",
  "Optimisation de vos tournées",
];

function PrivacySettings() {
  const settings = useDriverSettings();

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">Localisation pendant les missions</h3>
        <ToggleRow
          label="Partage de localisation"
          description="Utilisée uniquement pendant une mission active."
          checked={settings.locationSharing}
          onChange={(v) => {
            driverSettingsActions.setLocationSharing(v);
            toast.success(
              v ? "Partage de localisation activé" : "Partage de localisation désactivé",
            );
          }}
        >
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold ${settings.locationSharing ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {settings.locationSharing ? "Activée" : "Désactivée"}
          </span>
        </ToggleRow>
        <div className="rounded-xl border border-border p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Votre position est utilisée pour :
          </div>
          {USES.map((u) => (
            <div key={u} className="flex items-center gap-2 text-sm">
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {u}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Cette préférence définit le réglage de départ sur chaque mission — vous pouvez toujours
          l'ajuster ponctuellement depuis le suivi GPS d'une mission en cours.
        </p>
      </div>
    </div>
  );
}
