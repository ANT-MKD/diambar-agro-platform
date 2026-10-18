import { toast } from "sonner";
import { Bell, Lock } from "lucide-react";
import { SettingsCard, ToggleRow } from "@/components/common/settings-shell";
import { market } from "@/data/market-remote";
import { useMyAccount } from "@/data/store";
import { useServerForm } from "@/hooks/use-server-form";

// Réglage des notifications en mode base : uniquement ce que l'application
// envoie vraiment (dans la cloche), enregistré avec le compte. Ce qui demande
// d'agir (paiements, litiges, commande à confirmer…) arrive toujours.

type Role = "restaurant" | "farmer" | "driver";

const MUTABLE: Record<Role, { type: string; label: string; description: string }[]> = {
  restaurant: [
    {
      type: "order",
      label: "Suivi de mes commandes",
      description: "Confirmée, quantités ajustées, en route, livrée, annulée.",
    },
  ],
  farmer: [
    {
      type: "stock",
      label: "Stock faible",
      description: "Quand un produit passe sous son seuil d'alerte.",
    },
  ],
  driver: [
    {
      type: "offer",
      label: "Nouvelles courses disponibles",
      description: "Chaque course ouverte aux livreurs. Vos propres missions restent signalées.",
    },
  ],
};

const ALWAYS: Record<Role, string[]> = {
  restaurant: ["Paiements et remboursements", "Litiges", "Factures", "Commandes récurrentes"],
  farmer: ["Nouvelles commandes à confirmer", "Paiements et retraits", "Litiges"],
  driver: ["Missions acceptées, annulées", "Paiements et retraits", "Litiges"],
};

export function NotificationPrefsBase({ role }: { role: Role }) {
  const account = useMyAccount();
  const muted = account?.preferences.mutedNotifications ?? [];
  const [form, setForm] = useServerForm({
    on: Object.fromEntries(MUTABLE[role].map((m) => [m.type, !muted.includes(m.type)])),
    newsletter: account?.preferences.newsletter ?? false,
  });

  const save = async () => {
    const res = await market.savePreferences({
      mutedNotifications: MUTABLE[role].filter((m) => !form.on[m.type]).map((m) => m.type),
      newsletter: form.newsletter,
    });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    return true;
  };

  return (
    <SettingsCard
      title="Notifications"
      description="Elles arrivent dans l'application, sous la cloche en haut de l'écran."
      onSave={save}
    >
      {MUTABLE[role].map((m) => (
        <ToggleRow
          key={m.type}
          label={m.label}
          description={m.description}
          checked={!!form.on[m.type]}
          onChange={(v) => setForm({ ...form, on: { ...form.on, [m.type]: v } })}
        />
      ))}
      <div className="rounded-xl border border-border p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Toujours envoyées
        </div>
        {ALWAYS[role].map((label) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <Bell className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            {label}
          </div>
        ))}
      </div>
      {role !== "restaurant" && (
        <ToggleRow
          label="Nouvelles de Diambar Agro"
          description="Accepter de recevoir nos actualités (nouveautés, conseils)."
          checked={form.newsletter}
          onChange={(v) => setForm({ ...form, newsletter: v })}
        />
      )}
    </SettingsCard>
  );
}
