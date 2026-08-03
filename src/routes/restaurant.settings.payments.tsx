import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/restaurant/settings/payments")({
  head: () => ({
    meta: [
      { title: "Paiements · Paramètres restaurant · Diambar Agro" },
      { name: "description", content: "Méthodes de paiement, conditions de règlement et facturation de votre restaurant." },
      { property: "og:title", content: "Paiements · Paramètres restaurant" },
      { property: "og:description", content: "Méthodes de paiement et facturation." },
    ],
  }),
  component: RestaurantPaymentSettings,
});

const METHODS = ["Wave", "Orange Money", "Free Money", "Carte bancaire", "Virement bancaire"];

function RestaurantPaymentSettings() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ Wave: true, "Orange Money": true, "Free Money": true, "Carte bancaire": false, "Virement bancaire": true });
  const [billing, setBilling] = useState({ terms: "30", billingEmail: "compta@lebaobab.sn", autoPay: false });
  return (
    <>
      <SettingsCard title="Méthodes de paiement" description="Activez les moyens de règlement que vous utilisez.">
        {METHODS.map((m) => (
          <ToggleRow key={m} label={m} checked={enabled[m]} onChange={(v) => setEnabled({ ...enabled, [m]: v })} />
        ))}
      </SettingsCard>

      <SettingsCard title="Facturation" description="Conditions appliquées à vos factures fournisseurs.">
        <FieldRow label="Délai de règlement">
          <Select value={billing.terms} onValueChange={(v) => setBilling({ ...billing, terms: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Comptant</SelectItem>
              <SelectItem value="15">15 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="45">45 jours</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Email de facturation">
          <Input type="email" value={billing.billingEmail} onChange={(e) => setBilling({ ...billing, billingEmail: e.target.value })} />
        </FieldRow>
        <ToggleRow
          label="Prélèvement automatique"
          description="Régler automatiquement les factures à échéance"
          checked={billing.autoPay}
          onChange={(v) => setBilling({ ...billing, autoPay: v })}
        />
      </SettingsCard>
    </>
  );
}