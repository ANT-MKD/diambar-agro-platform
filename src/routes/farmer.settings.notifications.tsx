import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";
import { ChannelMatrix, TriggerRules } from "@/components/common/notification-rules";

export const Route = createFileRoute("/farmer/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Paramètres agriculteur · Diambar Agro" },
      { name: "description", content: "Choisissez les alertes commandes, paiements et stock que vous souhaitez recevoir." },
      { property: "og:title", content: "Notifications · Paramètres agriculteur" },
      { property: "og:description", content: "Gérez vos préférences d'alertes Diambar Agro." },
    ],
  }),
  component: NotificationSettings,
});

const EVENTS = [
  { key: "orders", label: "Nouvelles commandes", description: "Alerte immédiate à chaque commande reçue" },
  { key: "payments", label: "Paiements reçus", description: "Confirmation de versement sur votre wallet" },
  { key: "stock", label: "Stock faible", description: "Quand un produit passe sous le seuil minimum" },
  { key: "messages", label: "Nouveaux messages", description: "Messages des restaurants partenaires" },
  { key: "marketing", label: "Offres et nouveautés", description: "Conseils, nouveautés produits Diambar" },
] as const;

const CHANNELS = [
  { key: "inapp", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

const RULES = [
  { key: "new-order", label: "Commande urgente", condition: "commande > 100 000 FCFA ou livraison < 24h", channel: "WhatsApp + in-app immédiat", firedThisMonth: 12 },
  { key: "low-stock", label: "Stock critique", condition: "stock d'un produit < seuil minimum", channel: "Email quotidien + in-app", firedThisMonth: 5 },
  { key: "payout", label: "Versement wallet", condition: "paiement crédité sur le wallet", channel: "SMS + in-app", firedThisMonth: 8 },
  { key: "no-reply", label: "Message sans réponse", condition: "message client non lu depuis 2h", channel: "WhatsApp de rappel", firedThisMonth: 3 },
] as const;

function NotificationSettings() {
  const [events, setEvents] = useState<Record<string, boolean>>({ orders: true, payments: true, stock: true, messages: true, marketing: false });
  const [channels, setChannels] = useState<Record<string, boolean>>({ inapp: true, email: true, sms: false, whatsapp: true });
  return (
    <>
      <SettingsCard title="Événements" description="Choisissez ce dont vous voulez être averti.">
        {EVENTS.map((e) => (
          <ToggleRow
            key={e.key}
            label={e.label}
            description={e.description}
            checked={events[e.key]}
            onChange={(v) => setEvents({ ...events, [e.key]: v })}
          />
        ))}
      </SettingsCard>
      <SettingsCard title="Canaux de réception" description="Par quel moyen souhaitez-vous être contacté ?">
        {CHANNELS.map((c) => (
          <ToggleRow key={c.key} label={c.label} checked={channels[c.key]} onChange={(v) => setChannels({ ...channels, [c.key]: v })} />
        ))}
      </SettingsCard>
      <SettingsCard title="Matrice événements × canaux" description="Affinez le canal utilisé pour chaque type d'alerte.">
        <ChannelMatrix events={EVENTS} />
      </SettingsCard>
      <SettingsCard title="Règles de déclenchement" description="Automatisations qui décident quand et comment vous alerter.">
        <TriggerRules rules={RULES} />
      </SettingsCard>
    </>
  );
}