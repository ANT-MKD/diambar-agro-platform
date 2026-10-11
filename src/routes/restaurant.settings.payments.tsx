import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, farmers } from "@/data/mocks";
import { useRestaurantProfile, restaurantProfileActions, useRestaurantOrders } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { invoiceNumberFor } from "@/lib/invoice-data";

export const Route = createFileRoute("/restaurant/settings/payments")({
  head: () => ({
    meta: [
      { title: "Paiements · Paramètres restaurant · Diambar Agro" },
      {
        name: "description",
        content:
          "Méthodes de paiement, conditions de règlement et facturation de votre restaurant.",
      },
      { property: "og:title", content: "Paiements · Paramètres restaurant" },
      { property: "og:description", content: "Méthodes de paiement et facturation." },
    ],
  }),
  component: RestaurantPaymentSettings,
});

function RestaurantPaymentSettings() {
  const profile = useRestaurantProfile();
  const orders = useRestaurantOrders();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(PAYMENT_METHODS.map((m) => [m, profile.enabledPaymentMethods.includes(m)])),
  );
  const [billing, setBilling] = useState({
    terms: String(profile.paymentTermsDays),
    billingEmail: profile.billingEmail,
  });

  const saveMethods = () => {
    restaurantProfileActions.update({
      enabledPaymentMethods: PAYMENT_METHODS.filter((m) => enabled[m]),
    });
    return true;
  };

  const saveBilling = () => {
    restaurantProfileActions.update({
      paymentTermsDays: Number(billing.terms),
      billingEmail: billing.billingEmail,
    });
    return true;
  };

  const paidOrders = orders
    .filter((o) => o.paid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <>
      <SettingsCard
        title="Méthodes de paiement"
        description="Activez les moyens de règlement que vous utilisez au checkout."
        onSave={saveMethods}
      >
        {PAYMENT_METHODS.map((m) => (
          <ToggleRow
            key={m}
            label={m}
            description={m === "Espèces" ? "Réglé à la livraison" : "Paiement instantané"}
            checked={enabled[m]}
            onChange={(v) => setEnabled({ ...enabled, [m]: v })}
          />
        ))}
      </SettingsCard>

      <SettingsCard
        title="Facturation"
        description="Conditions appliquées à vos factures fournisseurs."
        onSave={saveBilling}
      >
        <FieldRow
          label="Délai de règlement"
          hint="Détermine la date d'échéance affichée sur vos factures."
        >
          <Select value={billing.terms} onValueChange={(v) => setBilling({ ...billing, terms: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Comptant</SelectItem>
              <SelectItem value="14">14 jours</SelectItem>
              <SelectItem value="30">30 jours</SelectItem>
              <SelectItem value="45">45 jours</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Email de facturation">
          <Input
            type="email"
            value={billing.billingEmail}
            onChange={(e) => setBilling({ ...billing, billingEmail: e.target.value })}
          />
        </FieldRow>
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold">Historique de paiement</h3>
        {paidOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement enregistré pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Facture</th>
                  <th className="py-2">Producteur</th>
                  <th className="py-2">Méthode</th>
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {paidOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="py-2.5">
                      <Link
                        to="/restaurant/invoices/$invoiceId"
                        params={{ invoiceId: o.id }}
                        className="text-primary hover:underline font-medium"
                      >
                        {invoiceNumberFor(o.id, o.createdAt, o.reference)}
                      </Link>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {farmers.find((f) => f.id === o.farmerId)?.name ?? "—"}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{o.paymentMethod}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        new Date(o.createdAt),
                      )}
                    </td>
                    <td className="py-2.5 text-right font-medium">{formatFCFA(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
