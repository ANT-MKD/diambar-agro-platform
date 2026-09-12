import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [form, setForm] = useState({
    wave: "77 123 45 67",
    orange: "78 200 33 44",
    free: "",
    primary: "wave",
    threshold: "25000",
  });
  return (
    <SettingsCard
      title="Méthodes de paiement"
      description="Comptes mobile money pour recevoir vos paiements."
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
      <FieldRow label="Méthode par défaut">
        <Select value={form.primary} onValueChange={(v) => setForm({ ...form, primary: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wave">Wave</SelectItem>
            <SelectItem value="orange">Orange Money</SelectItem>
            <SelectItem value="free">Free Money</SelectItem>
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
