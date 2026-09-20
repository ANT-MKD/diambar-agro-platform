import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ToggleRow } from "@/components/common/settings-shell";
import { ChannelMatrix, TriggerRules } from "@/components/common/notification-rules";
import { useDriverSettings, driverSettingsActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export const Route = createFileRoute("/driver/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Paramètres livreur" }] }),
  component: NotificationSettings,
});

const DRIVER_EVENTS = [
  {
    key: "missions",
    label: "Nouvelles missions",
    description: "Propositions correspondant à vos critères",
  },
  {
    key: "assigned",
    label: "Mission assignée",
    description: "Une mission vous est directement attribuée",
  },
  { key: "payments", label: "Paiements", description: "Virements et confirmations wallet" },
  { key: "messages", label: "Messages", description: "Restaurants et producteurs" },
  {
    key: "docs",
    label: "Documents véhicule",
    description: "Assurance ou visite technique à renouveler",
  },
] as const;

const DRIVER_RULES = [
  {
    key: "nearby",
    label: "Mission proche",
    condition: "mission à moins de 10 km de ma position",
    channel: "Push + WhatsApp immédiat",
  },
  {
    key: "express",
    label: "Mission express",
    condition: "urgence = express et rémunération > 8 000 FCFA",
    channel: "Push prioritaire + SMS",
  },
  {
    key: "payout",
    label: "Virement effectué",
    condition: "paiement Wave crédité",
    channel: "SMS + in-app",
  },
  {
    key: "docs",
    label: "Document expirant",
    condition: "document véhicule expire dans 30 jours",
    channel: "Email + in-app hebdomadaire",
  },
] as const;

function NotificationSettings() {
  const settings = useDriverSettings();
  const notif = settings.notif;
  const set = (patch: Partial<typeof notif>) => driverSettingsActions.setNotif(patch);

  const save = () => {
    toast.success("Préférences de notifications enregistrées");
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Matrice événements × canaux
          </div>
          <Button size="sm" onClick={save} className="gap-2">
            <Save className="h-3.5 w-3.5" />
            Enregistrer
          </Button>
        </div>
        <ChannelMatrix events={DRIVER_EVENTS} storageKey="driver-settings" />
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Règles de déclenchement
        </div>
        <TriggerRules rules={DRIVER_RULES} storageKey="driver-settings" />
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Canaux
        </div>
        <ToggleRow
          label="Push mobile"
          description="Notifications en temps réel"
          checked={notif.push}
          onChange={(v) => set({ push: v })}
        />
        <ToggleRow
          label="SMS"
          description="Alertes critiques par SMS"
          checked={notif.sms}
          onChange={(v) => set({ sms: v })}
        />
        <ToggleRow
          label="Email"
          description="Résumé hebdomadaire"
          checked={notif.email}
          onChange={(v) => set({ email: v })}
        />
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          🚚 Missions & paiements
        </div>
        <ToggleRow
          label="Nouvelles missions"
          description="Recevoir les propositions en temps réel"
          checked={notif.missions}
          onChange={(v) => set({ missions: v })}
        />
        <ToggleRow
          label="Paiements"
          description="Confirmations et virements"
          checked={notif.payments}
          onChange={(v) => set({ payments: v })}
        />
        <ToggleRow
          label="Messages"
          description="Nouveaux messages des restaurants"
          checked={notif.messages}
          onChange={(v) => set({ messages: v })}
        />
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          🚗 Véhicule
        </div>
        <ToggleRow
          label="Document bientôt expiré"
          description="Assurance, contrôle technique…"
          checked={notif.docExpiry}
          onChange={(v) => set({ docExpiry: v })}
        />
        <ToggleRow
          label="Entretien à venir"
          description="Rappel d'entretien programmé"
          checked={notif.maintenance}
          onChange={(v) => set({ maintenance: v })}
        />
        <ToggleRow
          label="Problème signalé"
          description="Suivi de vos signalements véhicule"
          checked={notif.vehicleIssue}
          onChange={(v) => set({ vehicleIssue: v })}
        />
        <ToggleRow
          label="Véhicule non conforme"
          description="Un document est expiré"
          checked={notif.nonCompliant}
          onChange={(v) => set({ nonCompliant: v })}
        />
      </div>
    </div>
  );
}
