import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";

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
    </>
  );
}