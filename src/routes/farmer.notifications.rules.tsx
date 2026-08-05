import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Zap } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { ChannelMatrix, TriggerRules, type EventDef, type TriggerRule } from "@/components/common/notification-rules";

export const Route = createFileRoute("/farmer/notifications/rules")({
  head: () => ({
    meta: [
      { title: "Règles de notification · Diambar Agro" },
      { name: "description", content: "Configurez les canaux (in-app, email, WhatsApp, SMS) et les règles de déclenchement." },
    ],
  }),
  component: RulesPage,
});

const EVENTS: EventDef[] = [
  { key: "order_new", label: "Nouvelle commande reçue" },
  { key: "order_cancel", label: "Commande annulée" },
  { key: "stock_low", label: "Stock bas / rupture" },
  { key: "payment_in", label: "Paiement reçu" },
  { key: "withdraw", label: "Retrait traité" },
  { key: "message", label: "Nouveau message" },
];

const RULES: TriggerRule[] = [
  { key: "r1", label: "Stock critique", condition: "Quantité < seuil minimum", channel: "In-app + WhatsApp", firedThisMonth: 12 },
  { key: "r2", label: "Commande urgente", condition: "Livraison demandée < 24h", channel: "In-app + SMS", firedThisMonth: 5 },
  { key: "r3", label: "Paiement crédité", condition: "Virement Wave confirmé", channel: "Email + In-app", firedThisMonth: 18 },
  { key: "r4", label: "Récap hebdomadaire", condition: "Chaque lundi 08h00", channel: "Email", firedThisMonth: 4 },
];

function RulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Règles de notification"
        subtitle="Choisissez quels événements vous alertent, et sur quels canaux"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/farmer/notifications"><ArrowLeft className="h-4 w-4" />Retour</Link>
          </Button>
        }
      />

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold">Canaux par événement</h3>
        <p className="text-xs text-muted-foreground mb-4">In-app, Email, WhatsApp et SMS · données simulées</p>
        <ChannelMatrix events={EVENTS} />
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />Règles de déclenchement</h3>
        <p className="text-xs text-muted-foreground mb-4">Conditions automatiques évaluées en temps réel</p>
        <TriggerRules rules={RULES} />
      </div>
    </div>
  );
}
