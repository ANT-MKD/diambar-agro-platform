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

export const Route = createFileRoute("/restaurant/notifications/rules")({
  head: () => ({
    meta: [
      { title: "Règles de notification · Restaurant" },
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
  { key: "order_status", label: "Changement de statut commande" },
  { key: "delivery", label: "Livraison en approche" },
  { key: "invoice", label: "Nouvelle facture disponible" },
  { key: "price_drop", label: "Baisse de prix sur un produit suivi" },
  { key: "restock", label: "Produit de nouveau en stock" },
  { key: "message", label: "Message d'un fournisseur" },
];

const RULES: TriggerRule[] = [
  {
    key: "r1",
    label: "Livraison imminente",
    condition: "ETA < 15 minutes",
    channel: "In-app + WhatsApp",
    firedThisMonth: 22,
  },
  {
    key: "r2",
    label: "Facture impayée",
    condition: "Échéance dépassée de 3 jours",
    channel: "Email + SMS",
    firedThisMonth: 2,
  },
  {
    key: "r3",
    label: "Produit favori disponible",
    condition: "Réapprovisionnement fournisseur suivi",
    channel: "In-app",
    firedThisMonth: 9,
  },
  {
    key: "r4",
    label: "Commande récurrente",
    condition: "24h avant déclenchement automatique",
    channel: "Email + In-app",
    firedThisMonth: 6,
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
            <Link to="/restaurant/notifications">
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
        <ChannelMatrix events={EVENTS} />
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          Règles de déclenchement
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Conditions automatiques évaluées en temps réel
        </p>
        <TriggerRules rules={RULES} />
      </div>
    </div>
  );
}
