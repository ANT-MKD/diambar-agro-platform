import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Switch } from "@/components/ui/switch";
import { formatFCFA } from "@/lib/format";
import {
  platformSettingsActions,
  useCommissionTiers,
  useDeliveryZones,
  useRefundSettings,
} from "@/data/admin-store";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres plateforme — Administration Diambar Agro" },
      {
        name: "description",
        content: "Barème de commissions, zones de livraison et règles de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const tiers = useCommissionTiers();
  const zones = useDeliveryZones();
  const refundSettings = useRefundSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres plateforme"
        subtitle="Commissions, zones de livraison et règles métier"
      />

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Barème de commissions</h2>
        <p className="text-xs text-muted-foreground">
          Taux dégressif appliqué au volume mensuel du producteur.
        </p>
        <div className="mt-4 space-y-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-40">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.range}</div>
              </div>
              <input
                type="number"
                min={0}
                max={30}
                value={t.rate}
                onChange={(e) => platformSettingsActions.setTierRate(t.id, Number(e.target.value))}
                className="w-20 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Les taux sont enregistrés automatiquement à chaque modification.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Zones de livraison</h2>
        <p className="text-xs text-muted-foreground">
          Activez une zone pour ouvrir les commandes correspondantes.
        </p>
        <div className="mt-4 space-y-3">
          {zones.map((z) => (
            <div
              key={z.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-40">
                <div className="text-sm font-medium">{z.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Base {formatFCFA(z.baseFee)} · {z.perKm} FCFA/km
                </div>
              </div>
              <input
                type="number"
                min={0}
                step={500}
                value={z.baseFee}
                onChange={(e) => platformSettingsActions.setZoneFee(z.id, Number(e.target.value))}
                className="w-28 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right"
              />
              <Switch
                checked={z.active}
                onCheckedChange={() => {
                  platformSettingsActions.toggleZone(z.id);
                  toast.success(z.active ? "Zone désactivée" : "Zone activée");
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Remboursements</h2>
        <p className="text-xs text-muted-foreground">
          Au-delà de ce montant, une justification écrite devient obligatoire pour approuver un
          remboursement ou un geste commercial.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
          <div className="flex-1 min-w-40">
            <div className="text-sm font-medium">Seuil de justification obligatoire</div>
            <div className="text-[11px] text-muted-foreground">
              Actuellement {formatFCFA(refundSettings.justificationThreshold)}
            </div>
          </div>
          <input
            type="number"
            min={0}
            step={5000}
            defaultValue={refundSettings.justificationThreshold}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= 0) {
                platformSettingsActions.setRefundJustificationThreshold(value);
                toast.success("Seuil mis à jour");
              }
            }}
            className="w-32 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right"
          />
          <span className="text-sm text-muted-foreground">FCFA</span>
        </div>
      </div>
    </div>
  );
}
