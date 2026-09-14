import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import {
  ChannelMatrix,
  TriggerRules,
  type EventDef,
  type TriggerRule,
} from "@/components/common/notification-rules";

export const Route = createFileRoute("/driver/notifications/rules")({
  head: () => ({
    meta: [
      { title: "Règles de notification · Livreur" },
      {
        name: "description",
        content:
          "Configurez les canaux (in-app, email, WhatsApp, SMS) et les règles de déclenchement.",
      },
    ],
  }),
  component: RulesPage,
});

const EVENTS: EventDef[] = [
  { key: "mission_new", label: "Nouvelle mission proposée" },
  { key: "mission_cancel", label: "Mission annulée" },
  { key: "payout", label: "Versement effectué" },
  { key: "bonus", label: "Bonus débloqué" },
  { key: "doc_expiry", label: "Document véhicule bientôt expiré" },
  { key: "message", label: "Message client / producteur" },
];

const RULES: TriggerRule[] = [
  {
    key: "r1",
    label: "Mission proche",
    condition: "Pickup à moins de 5 km",
    channel: "In-app + SMS",
    firedThisMonth: 31,
  },
  {
    key: "r2",
    label: "Mission bien rémunérée",
    condition: "Gain > 10 000 FCFA",
    channel: "In-app + WhatsApp",
    firedThisMonth: 8,
  },
  {
    key: "r3",
    label: "Versement Wave",
    condition: "Retrait validé",
    channel: "SMS + In-app",
    firedThisMonth: 4,
  },
  {
    key: "r4",
    label: "Assurance à renouveler",
    condition: "Expiration < 30 jours",
    channel: "Email",
    firedThisMonth: 1,
  },
];

function RulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Règles de notification"
        subtitle="Choisissez quels événements vous alertent, et sur quels canaux"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/driver/notifications">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold">Canaux par événement</h3>
        <p className="text-xs text-muted-foreground mb-4">
          In-app, Email, WhatsApp et SMS · données simulées
        </p>
        <ChannelMatrix events={EVENTS} storageKey="driver-rules" />
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Règles de déclenchement
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Conditions automatiques évaluées en temps réel
        </p>
        <TriggerRules rules={RULES} storageKey="driver-rules" />
      </div>
    </div>
  );
}
