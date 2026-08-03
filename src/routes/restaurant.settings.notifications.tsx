import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";

export const Route = createFileRoute("/restaurant/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Paramètres restaurant · Diambar Agro" },
      { name: "description", content: "Gérez les alertes commandes, livraisons et factures de votre restaurant." },
      { property: "og:title", content: "Notifications · Paramètres restaurant" },
      { property: "og:description", content: "Préférences d'alertes de votre restaurant." },
    ],
  }),
  component: RestaurantNotificationSettings,
});

const EVENTS = [
  { key: "orders", label: "Mises à jour de commandes", description: "Confirmation, préparation, expédition" },
  { key: "delivery", label: "Livraisons en approche", description: "Alerte quand le livreur est à moins de 10 min" },
  { key: "invoices", label: "Factures et échéances", description: "Nouvelle facture, relance impayée" },
  { key: "stock", label: "Stock fournisseurs", description: "Rupture ou retour en stock d'un produit suivi" },
  { key: "messages", label: "Messages", description: "Nouveaux messages des producteurs" },
  { key: "promos", label: "Promotions & nouveautés", description: "Bons plans saisonniers" },
] as const;

const CHANNELS = [
  { key: "inapp", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

function RestaurantNotificationSettings() {
  const [events, setEvents] = useState<Record<string, boolean>>({ orders: true, delivery: true, invoices: true, stock: true, messages: true, promos: false });
  const [channels, setChannels] = useState<Record<string, boolean>>({ inapp: true, email: true, sms: false, whatsapp: true });
  return (
    <>
      <SettingsCard title="Événements" description="Choisissez ce dont vous voulez être averti.">
        {EVENTS.map((e) => (
          <ToggleRow key={e.key} label={e.label} description={e.description} checked={events[e.key]} onChange={(v) => setEvents({ ...events, [e.key]: v })} />
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