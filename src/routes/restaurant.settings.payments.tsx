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
import { farmers } from "@/data/mocks";
import { useRestaurantProfile, restaurantProfileActions, useRestaurantOrders } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { invoiceNumberFor } from "@/lib/invoice-data";
import { useRules } from "@/data/rules";
import { toast } from "sonner";
import { market } from "@/data/market-remote";
import { useBaseMode } from "@/data/demo-only";
import { useServerForm } from "@/hooks/use-server-form";

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
  // Seuls les moyens de paiement ouverts par Diambar sont proposés.
  const PAYMENT_METHODS = useRules().paymentMethods;
  const orders = useRestaurantOrders();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(PAYMENT_METHODS.map((m) => [m, profile.enabledPaymentMethods.includes(m)])),
  );
  const base = useBaseMode();
  const [billing, setBilling] = useServerForm({
    terms: String(profile.paymentTermsDays),
    billingEmail: profile.billingEmail,
  });

  const saveMethods = () => {
    restaurantProfileActions.update({
      enabledPaymentMethods: PAYMENT_METHODS.filter((m) => enabled[m]),
    });
    return true;
  };

  const saveBilling = async () => {
    if (market.isRemote()) {
      // Seul l'email de facturation se règle ici ; le délai est fixé par Diambar.
      const res = await market.saveRestaurant({ billingEmail: billing.billingEmail });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
      return true;
    }
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
      {base ? (
        <div className="glass rounded-2xl p-6 space-y-2">
          <h3 className="font-semibold">Moyens de paiement acceptés</h3>
          <p className="text-sm text-muted-foreground">
            Ouverts par Diambar pour toutes les commandes : vous choisissez à chaque panier.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {PAYMENT_METHODS.map((m) => (
              <span
                key={m}
                className="rounded-full border border-border px-3 py-1 text-sm font-medium"
              >
                {m}
                {m === "Espèces" ? " · à la livraison" : ""}
              </span>
            ))}
          </div>
        </div>
      ) : (
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
      )}

      <SettingsCard
        title="Facturation"
        description="Conditions appliquées à vos factures fournisseurs."
        onSave={saveBilling}
      >
        <FieldRow
          label="Délai de règlement"
          hint={
            base
              ? "Fixé par Diambar : le paiement se fait à la commande (ou à la livraison en espèces)."
              : "Détermine la date d'échéance affichée sur vos factures."
          }
        >
          <Select
            value={billing.terms}
            disabled={base}
            onValueChange={(v) => setBilling({ ...billing, terms: v })}
          >
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

      {base ? (
        <div className="glass rounded-2xl p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Factures et paiements</h3>
            <p className="text-sm text-muted-foreground">
              Vos factures numérotées et leurs paiements.
            </p>
          </div>
          <Link to="/restaurant/invoices" className="text-sm font-semibold text-primary">
            Voir mes factures
          </Link>
        </div>
      ) : (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold">Historique de paiement</h3>
          {paidOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun paiement enregistré pour l'instant.
            </p>
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
      )}
    </>
  );
}
