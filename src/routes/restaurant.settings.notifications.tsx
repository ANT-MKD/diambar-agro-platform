import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";
import { ChannelMatrix, TriggerRules } from "@/components/common/notification-rules";

const STORAGE_KEY = "diambar:notif-prefs:restaurant-settings";

export const Route = createFileRoute("/restaurant/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Paramètres restaurant · Diambar Agro" },
      {
        name: "description",
        content: "Gérez les alertes commandes, livraisons et factures de votre restaurant.",
      },
      { property: "og:title", content: "Notifications · Paramètres restaurant" },
      { property: "og:description", content: "Préférences d'alertes de votre restaurant." },
    ],
  }),
  component: RestaurantNotificationSettings,
});

const EVENTS = [
  {
    key: "orders",
    label: "Mises à jour de commandes",
    description: "Confirmation, préparation, expédition",
  },
  {
    key: "delivery",
    label: "Livraisons en approche",
    description: "Alerte quand le livreur est à moins de 10 min",
  },
  {
    key: "invoices",
    label: "Factures et échéances",
    description: "Nouvelle facture, relance impayée",
  },
  {
    key: "stock",
    label: "Stock fournisseurs",
    description: "Rupture ou retour en stock d'un produit suivi",
  },
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
  {
    key: "eta",
    label: "Livreur proche",
    condition: "ETA livreur < 10 min",
    channel: "WhatsApp + in-app",
  },
  {
    key: "late",
    label: "Retard de livraison",
    condition: "livraison en retard de plus de 20 min",
    channel: "SMS + email au gérant",
  },
  {
    key: "invoice",
    label: "Facture à échéance",
    condition: "facture impayée à J-3",
    channel: "Email + in-app",
  },
  {
    key: "restock",
    label: "Produit suivi de retour",
    condition: "produit favori de nouveau en stock",
    channel: "In-app quotidien",
  },
] as const;

const DEFAULT_EVENTS: Record<string, boolean> = {
  orders: true,
  delivery: true,
  invoices: true,
  stock: true,
  messages: true,
  promos: false,
};
const DEFAULT_CHANNELS: Record<string, boolean> = {
  inapp: true,
  email: true,
  sms: false,
  whatsapp: true,
};

function RestaurantNotificationSettings() {
  const [events, setEvents] = useState<Record<string, boolean>>(DEFAULT_EVENTS);
  const [channels, setChannels] = useState<Record<string, boolean>>(DEFAULT_CHANNELS);

  // Hydratation après montage uniquement (localStorage indisponible au premier
  // rendu), pour rester cohérent avec le pattern déjà utilisé par ChannelMatrix
  // et TriggerRules (usePersisted) sur cette même page.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { events?: typeof events; channels?: typeof channels };
        if (saved.events) setEvents({ ...DEFAULT_EVENTS, ...saved.events });
        if (saved.channels) setChannels({ ...DEFAULT_CHANNELS, ...saved.channels });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (nextEvents: typeof events, nextChannels: typeof channels) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ events: nextEvents, channels: nextChannels }),
      );
    } catch {
      /* ignore */
    }
  };

  const setEventsPersisted = (v: typeof events) => {
    setEvents(v);
    persist(v, channels);
  };
  const setChannelsPersisted = (v: typeof channels) => {
    setChannels(v);
    persist(events, v);
  };

  return (
    <>
      <SettingsCard title="Événements" description="Choisissez ce dont vous voulez être averti.">
        {EVENTS.map((e) => (
          <ToggleRow
            key={e.key}
            label={e.label}
            description={e.description}
            checked={events[e.key]}
            onChange={(v) => setEventsPersisted({ ...events, [e.key]: v })}
          />
        ))}
      </SettingsCard>
      <SettingsCard
        title="Canaux de réception"
        description="Par quel moyen souhaitez-vous être contacté ?"
      >
        {CHANNELS.map((c) => (
          <ToggleRow
            key={c.key}
            label={c.label}
            checked={channels[c.key]}
            onChange={(v) => setChannelsPersisted({ ...channels, [c.key]: v })}
          />
        ))}
      </SettingsCard>
      <SettingsCard
        title="Matrice événements × canaux"
        description="Affinez le canal utilisé pour chaque type d'alerte."
      >
        <ChannelMatrix events={EVENTS} storageKey="restaurant-settings" />
      </SettingsCard>
      <SettingsCard
        title="Règles de déclenchement"
        description="Automatisations qui décident quand et comment alerter votre équipe."
      >
        <TriggerRules rules={RULES} storageKey="restaurant-settings" />
      </SettingsCard>
    </>
  );
}
