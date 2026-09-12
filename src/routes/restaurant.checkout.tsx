import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  CreditCard,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/farmer/page-header";
import { useCart, useProducts, cartActions, restaurantOrderActions } from "@/data/store";
import { farmers, type PaymentMethod } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/restaurant/checkout")({
  head: () => ({ meta: [{ title: "Commander · Restaurant" }] }),
  component: Checkout,
});

const PAY: PaymentMethod[] = ["Wave", "Orange Money", "Free Money", "Espèces"];

const step1Schema = z.object({
  address: z.string().trim().min(10, "Adresse trop courte (min 10 caractères)"),
  slot: z.string().min(1, "Choisissez un créneau"),
});

function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();
  const products = useProducts();
  const lines = cart
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.pricePerKg * l.qty, 0);
  const delivery = Math.round(subtotal * 0.03);
  const total = subtotal + delivery;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [address, setAddress] = useState("Le Baobab, Dakar Plateau");
  const [slot, setSlot] = useState("Demain · 08:00 – 10:00");
  const [method, setMethod] = useState<PaymentMethod>("Wave");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const farmerGroups = useMemo(
    () => farmers.filter((f) => lines.some((l) => l.product.farmerId === f.id)),
    [lines],
  );

  if (lines.length === 0 && step !== 3) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Votre panier est vide.
      </div>
    );
  }

  const goStep2 = () => {
    const parsed = step1Schema.safeParse({ address, slot });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      toast.error("Corrigez les erreurs du formulaire");
      return;
    }
    setErrors({});
    setStep(2);
  };

  const confirm = () => {
    const created: string[] = [];
    farmerGroups.forEach((f) => {
      const items = lines
        .filter((l) => l.product.farmerId === f.id)
        .map((l) => ({ productId: l.productId, qty: l.qty, price: l.product.pricePerKg }));
      const fSubtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
      const id = restaurantOrderActions.create({
        farmerId: f.id,
        items,
        total: fSubtotal,
        deliveryAddress: address,
        paymentMethod: method,
        eta: "24h",
      });
      created.push(id);
    });
    setOrderIds(created);
    cartActions.clear();
    toast.success("Commande passée avec succès");
    setStep(3);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Finaliser la commande" subtitle={`Étape ${step} sur 3`} />

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`text-xs font-medium ${step >= s ? "" : "text-muted-foreground"}`}>
              {s === 1 ? "Livraison" : s === 2 ? "Paiement" : "Confirmation"}
            </span>
            {s < 3 && <div className={`flex-1 h-px ${step > s ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 glass rounded-2xl p-6 space-y-4">
          {step === 1 && (
            <>
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Adresse de livraison
              </h3>
              <div className="space-y-2">
                <Label>Adresse complète</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  aria-invalid={!!errors.address}
                />
                {errors.address && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.address}
                  </p>
                )}
              </div>
              <h3 className="font-display text-lg font-bold flex items-center gap-2 pt-3">
                <Calendar className="h-5 w-5 text-primary" />
                Créneau souhaité
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  "Aujourd'hui · 14:00 – 16:00",
                  "Aujourd'hui · 17:00 – 19:00",
                  "Demain · 08:00 – 10:00",
                  "Demain · 14:00 – 16:00",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={`text-left p-3 rounded-xl border text-sm transition ${slot === s ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errors.slot && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.slot}
                </p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Méthode de paiement
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {PAY.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`p-4 rounded-xl border text-left transition ${method === m ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                  >
                    <div className="font-semibold text-sm">{m}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {m === "Espèces" ? "À la livraison" : "Paiement instantané"}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <div className="text-center py-8 space-y-3">
              <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground grid place-items-center mx-auto">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="font-display text-2xl font-bold">Commande confirmée 🎉</h3>
              <p className="text-sm text-muted-foreground">
                {farmerGroups.length} commande(s) envoyée(s) à vos producteurs. Vous recevrez une
                notification de confirmation.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {orderIds[0] && (
                  <Button
                    onClick={() =>
                      navigate({
                        to: "/restaurant/orders/$orderId",
                        params: { orderId: orderIds[0] },
                      })
                    }
                  >
                    Suivre la livraison
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate({ to: "/restaurant/orders" })}>
                  Mes commandes
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/restaurant/invoices" })}>
                  Mes factures
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3 lg:sticky lg:top-4">
          <h3 className="font-display text-lg font-bold">Récapitulatif</h3>
          <div className="space-y-2 text-sm max-h-48 overflow-auto">
            {lines.map((l) => (
              <div key={l.productId} className="flex justify-between gap-2">
                <span className="text-muted-foreground truncate">
                  {l.product.name} ×{l.qty}
                </span>
                <span>{formatFCFA(l.product.pricePerKg * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatFCFA(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Livraison</span>
              <span>{formatFCFA(delivery)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Total</span>
              <span className="text-primary">{formatFCFA(total)}</span>
            </div>
          </div>

          {step !== 3 && (
            <div className="flex gap-2 pt-2">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep((step - 1) as 1 | 2)}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
              )}
              {step < 2 && (
                <Button onClick={goStep2} className="flex-1 gap-1">
                  Continuer <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === 2 && (
                <Button onClick={confirm} className="flex-1 gap-1">
                  Confirmer <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
