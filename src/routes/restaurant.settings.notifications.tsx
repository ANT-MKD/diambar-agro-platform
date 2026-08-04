import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";
import { ChannelMatrix, TriggerRules } from "@/components/common/notification-rules";

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

const RULES = [
  { key: "eta", label: "Livreur proche", condition: "ETA livreur < 10 min", channel: "WhatsApp + in-app", firedThisMonth: 21 },
  { key: "late", label: "Retard de livraison", condition: "livraison en retard de plus de 20 min", channel: "SMS + email au gérant", firedThisMonth: 4 },
  { key: "invoice", label: "Facture à échéance", condition: "facture impayée à J-3", channel: "Email + in-app", firedThisMonth: 6 },
  { key: "restock", label: "Produit suivi de retour", condition: "produit favori de nouveau en stock", channel: "In-app quotidien", firedThisMonth: 9 },
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
      <SettingsCard title="Matrice événements × canaux" description="Affinez le canal utilisé pour chaque type d'alerte.">
        <ChannelMatrix events={EVENTS} />
      </SettingsCard>
      <SettingsCard title="Règles de déclenchement" description="Automatisations qui décident quand et comment alerter votre équipe.">
        <TriggerRules rules={RULES} />
      </SettingsCard>
    </>
  );
}