import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PaymentMethod } from "@/data/mocks";
import { useWallets, walletActions, usePaymentPrefs, paymentPrefsActions } from "@/data/store";

export const Route = createFileRoute("/farmer/settings/payments")({
  head: () => ({
    meta: [
      { title: "Paiements · Paramètres agriculteur · Diambar Agro" },
      {
        name: "description",
        content:
          "Configurez vos comptes Wave, Orange Money et Free Money pour recevoir vos paiements.",
      },
      { property: "og:title", content: "Paiements · Paramètres agriculteur" },
      { property: "og:description", content: "Comptes mobile money pour recevoir vos paiements." },
    ],
  }),
  component: PaymentSettings,
});

function PaymentSettings() {
  const wallets = useWallets();
  const paymentPrefs = usePaymentPrefs();
  const [form, setForm] = useState(() => ({
    wave: wallets.find((w) => w.method === "Wave")?.phone ?? "",
    orange: wallets.find((w) => w.method === "Orange Money")?.phone ?? "",
    free: wallets.find((w) => w.method === "Free Money")?.phone ?? "",
    primary: paymentPrefs.primary,
    threshold: String(paymentPrefs.withdrawThreshold),
  }));

  const save = () => {
    const byMethod: Record<string, string> = {
      Wave: form.wave,
      "Orange Money": form.orange,
      "Free Money": form.free,
    };
    if (!byMethod[form.primary]?.trim()) {
      toast.error("Renseignez un numéro pour votre méthode par défaut");
      return false;
    }
    const threshold = Number(form.threshold);
    if (!Number.isFinite(threshold) || threshold < 5000) {
      toast.error("Le seuil de retrait doit être d'au moins 5 000 FCFA");
      return false;
    }
    walletActions.setPhone("Wave", form.wave.trim());
    walletActions.setPhone("Orange Money", form.orange.trim());
    walletActions.setPhone("Free Money", form.free.trim());
    paymentPrefsActions.setPrimary(form.primary);
    paymentPrefsActions.setThreshold(threshold);
    return true;
  };

  return (
    <SettingsCard
      title="Méthodes de paiement"
      description="Comptes mobile money pour recevoir vos paiements. Ce sont les mêmes comptes proposés lors d'une demande de retrait."
      onSave={save}
    >
      <FieldRow label="Wave">
        <Input
          value={form.wave}
          onChange={(e) => setForm({ ...form, wave: e.target.value })}
          placeholder="Numéro Wave"
        />
      </FieldRow>
      <FieldRow label="Orange Money">
        <Input
          value={form.orange}
          onChange={(e) => setForm({ ...form, orange: e.target.value })}
          placeholder="Numéro Orange Money"
        />
      </FieldRow>
      <FieldRow label="Free Money">
        <Input
          value={form.free}
          onChange={(e) => setForm({ ...form, free: e.target.value })}
          placeholder="Numéro Free Money"
        />
      </FieldRow>
      <FieldRow label="Méthode par défaut" hint="Présélectionnée lors d'une demande de retrait.">
        <Select
          value={form.primary}
          onValueChange={(v) => setForm({ ...form, primary: v as PaymentMethod })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Wave">Wave</SelectItem>
            <SelectItem value="Orange Money">Orange Money</SelectItem>
            <SelectItem value="Free Money">Free Money</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow
        label="Seuil de retrait automatique (FCFA)"
        hint="Un retrait est proposé dès que votre solde dépasse ce montant."
      >
        <Input
          type="number"
          step="1000"
          value={form.threshold}
          onChange={(e) => setForm({ ...form, threshold: e.target.value })}
        />
      </FieldRow>
    </SettingsCard>
  );
}
