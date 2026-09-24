import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
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
import { PromoCodeField } from "@/components/restaurant/promo-code-field";
import {
  useCart,
  useProducts,
  cartActions,
  restaurantOrderActions,
  useRestaurantProfile,
  restaurantProfileActions,
  useSuppliers,
  getRestaurantOrderById,
  stockShortages,
  useRestaurantOrders,
} from "@/data/store";
import { useDeliveryZones } from "@/data/platform-settings";
import {
  allocate,
  deliveryFeeForZone,
  MIN_ORDER_PER_PRODUCER,
  zoneForAddress,
} from "@/lib/pricing";
import { useCreditNotesForRestaurant, isCreditExpired, creditActions } from "@/data/disputes";
import { farmers, restaurants, PAYMENT_METHODS, type PaymentMethod } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { cutoffHint, deliverySlots } from "@/lib/reception-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/restaurant/checkout")({
  head: () => ({ meta: [{ title: "Commander · Restaurant" }] }),
  component: Checkout,
});

const step1Schema = z.object({
  address: z.string().trim().min(10, "Adresse trop courte (min 10 caractères)"),
  slot: z.string().min(1, "Choisissez un créneau"),
});

function Checkout() {
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const suppliers = useSuppliers();
  const cart = useCart();
  const products = useProducts();
  const profile = useRestaurantProfile();
  const lines = cart
    .map((l) => ({ ...l, product: products.find((p) => p.id === l.productId)! }))
    .filter((l) => l.product);
  const suspendedFarmerIds = new Set(
    suppliers
      .filter((s) => s.restaurantId === myRestaurant?.id && s.suspended)
      .map((s) => s.farmerId),
  );
  const hasSuspendedSupplier = lines.some((l) => suspendedFarmerIds.has(l.product.farmerId));
  const subtotal = lines.reduce((s, l) => s + l.product.pricePerKg * l.qty, 0);
  const zones = useDeliveryZones();
  const pastOrders = useRestaurantOrders();
  const isFirstOrder = !pastOrders.some((o) => o.status !== "cancelled");
  const [address, setAddress] = useState(profile.deliveryAddress);
  // Frais réglés par l'admin pour la zone de livraison, une livraison par
  // producteur du panier (chaque producteur a sa propre course).
  const zone = zoneForAddress(zones, profile.city, address);
  const producerCount = new Set(lines.map((l) => l.product.farmerId)).size;
  const feePerDelivery = zone ? deliveryFeeForZone(zone) : 0;
  const delivery = feePerDelivery * producerCount;
  const zoneProblem = !zone
    ? "Cette adresse n'est dans aucune zone desservie par Diambar Agro."
    : !zone.active
      ? `La zone ${zone.name} n'est pas encore desservie : commande impossible pour le moment.`
      : null;
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);

  const credits = useCreditNotesForRestaurant(myRestaurant?.name ?? "");
  const availableCredits = credits.filter((c) => c.status === "issued" && !isCreditExpired(c));
  const [appliedCreditId, setAppliedCreditId] = useState<string | null>(null);
  const appliedCredit = availableCredits.find((c) => c.id === appliedCreditId) ?? null;
  const creditDiscount = appliedCredit
    ? Math.min(appliedCredit.amount, Math.max(0, subtotal + delivery - promoDiscount))
    : 0;

  const total = Math.max(0, subtotal + delivery - promoDiscount - creditDiscount);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  // Le panier est vidé après confirmation, ce qui remettrait sous-total/total/
  // nombre de commandes à zéro à l'étape 3 si on continuait à lire les valeurs
  // dérivées du panier live : on fige donc le récapitulatif au moment de payer.
  const [confirmedSummary, setConfirmedSummary] = useState<{
    count: number;
    subtotal: number;
    delivery: number;
    discount: number;
    creditApplied: number;
    total: number;
  } | null>(null);
  const availableSlots = useMemo(
    () => deliverySlots(profile.receptionHours),
    [profile.receptionHours],
  );
  const availableMethods =
    profile.enabledPaymentMethods.length > 0 ? profile.enabledPaymentMethods : PAYMENT_METHODS;
  const [slot, setSlot] = useState(availableSlots[0]?.label ?? "");
  const chosenSlot = availableSlots.find((s) => s.label === slot);
  const [shortagePreference, setShortagePreference] = useState<"partial" | "cancel">("partial");
  const [method, setMethod] = useState<PaymentMethod>(
    availableMethods.includes(profile.paymentMethod) ? profile.paymentMethod : availableMethods[0],
  );
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

  const underMinimum = farmerGroups
    .map((f) => ({
      name: f.name,
      amount: lines
        .filter((l) => l.product.farmerId === f.id)
        .reduce((s, l) => s + l.product.pricePerKg * l.qty, 0),
    }))
    .filter((g) => g.amount < MIN_ORDER_PER_PRODUCER);
  const minimumProblem =
    underMinimum.length > 0
      ? `Minimum ${formatFCFA(MIN_ORDER_PER_PRODUCER)} de marchandise par producteur : complétez chez ${underMinimum.map((g) => g.name).join(", ")}.`
      : null;

  const goStep2 = () => {
    if (minimumProblem) {
      toast.error(minimumProblem);
      return;
    }
    if (zoneProblem) {
      toast.error(zoneProblem);
      return;
    }
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
    if (hasSuspendedSupplier) {
      toast.error("Retirez du panier les produits d'un fournisseur suspendu avant de commander");
      return;
    }
    if (zoneProblem || minimumProblem) {
      toast.error(zoneProblem ?? minimumProblem);
      return;
    }
    // Le stock a pu baisser depuis l'ajout au panier (autre restaurant,
    // commande récurrente…) : on revérifie au moment de payer.
    const shortages = stockShortages(lines.map((l) => ({ productId: l.productId, qty: l.qty })));
    if (shortages.length > 0) {
      toast.error(
        `Stock insuffisant : ${shortages
          .map((x) => `${x.name} (${x.available} disponible(s))`)
          .join(", ")}. Ajustez votre panier.`,
      );
      return;
    }
    const groups = farmerGroups.map((f) => {
      const items = lines
        .filter((l) => l.product.farmerId === f.id)
        .map((l) => ({ productId: l.productId, qty: l.qty, price: l.product.pricePerKg }));
      return { farmer: f, items, subtotal: items.reduce((s, i) => s + i.qty * i.price, 0) };
    });
    // Promo et avoir sont répartis entre les commandes au prorata de leur
    // montant : chaque commande (et chaque facture) porte sa vraie part.
    const weights = groups.map((g) => g.subtotal + feePerDelivery);
    const promoParts = allocate(promoDiscount, weights);
    const creditParts = allocate(creditDiscount, weights);
    const created: string[] = [];
    groups.forEach((g, idx) => {
      const id = restaurantOrderActions.create({
        farmerId: g.farmer.id,
        items: g.items,
        subtotal: g.subtotal,
        deliveryFee: feePerDelivery,
        promoDiscount: promoParts[idx],
        promoCode: promoCode ?? undefined,
        creditApplied: creditParts[idx],
        creditId: creditParts[idx] > 0 ? appliedCredit?.id : undefined,
        total: g.subtotal + feePerDelivery - promoParts[idx] - creditParts[idx],
        deliveryAddress: address,
        paymentMethod: method,
        eta: slot,
        slotStart: chosenSlot?.start,
        shortagePreference,
      });
      created.push(id);
    });
    if (appliedCredit && created[0] && creditDiscount > 0) {
      // Seule la part réellement utilisée est retirée de l'avoir : le reste
      // reste disponible pour une prochaine commande.
      const ref = getRestaurantOrderById(created[0])?.reference ?? created[0];
      creditActions.redeem(appliedCredit.id, ref, creditDiscount);
    }
    setOrderIds(created);
    setConfirmedSummary({
      count: farmerGroups.length,
      subtotal,
      delivery,
      discount: promoDiscount,
      creditApplied: creditDiscount,
      total,
    });
    cartActions.clear();
    // L'adresse et la méthode utilisées deviennent les vraies préférences du
    // restaurant, préremplies aux prochaines commandes.
    restaurantProfileActions.update({ deliveryAddress: address, paymentMethod: method });
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
                {minimumProblem && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {minimumProblem}
                  </p>
                )}
                {zoneProblem && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {zoneProblem}
                  </p>
                )}
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
              <p className="text-xs text-muted-foreground">{cutoffHint()}</p>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun créneau de réception n'est configuré. Ouvrez au moins un jour dans{" "}
                  <Link
                    to="/restaurant/settings/establishment"
                    className="text-primary hover:underline"
                  >
                    Paramètres → Établissement
                  </Link>
                  .
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {availableSlots.map((s) => (
                    <button
                      key={s.start}
                      onClick={() => setSlot(s.label)}
                      className={`text-left p-3 rounded-xl border text-sm transition ${slot === s.label ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
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
              {hasSuspendedSupplier && (
                <div className="rounded-xl p-3 border border-destructive/40 bg-destructive/5 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  Votre panier contient un produit d'un fournisseur suspendu dans votre carnet.
                  Retirez-le du panier pour pouvoir confirmer la commande.
                </div>
              )}
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Méthode de paiement
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {availableMethods.map((m) => (
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
              <h3 className="font-display text-base font-bold pt-3">
                Si le producteur n'a pas toute la quantité
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    [
                      "partial",
                      "Livrer ce qui est disponible",
                      "La différence vous est remboursée.",
                    ],
                    ["cancel", "Annuler la commande", "Remboursement intégral, rien n'est livré."],
                  ] as const
                ).map(([value, title, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShortagePreference(value)}
                    className={`p-3 rounded-xl border text-left transition ${shortagePreference === value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                  >
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
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
                {confirmedSummary?.count ?? farmerGroups.length} commande(s) envoyée(s) à vos
                producteurs. Vous recevrez une notification de confirmation.
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
          {step !== 3 && (
            <PromoCodeField
              isFirstOrder={isFirstOrder}
              subtotal={subtotal}
              deliveryFee={delivery}
              appliedCode={promoCode}
              discount={promoDiscount}
              onApply={(code, amount) => {
                setPromoCode(code);
                setPromoDiscount(amount);
              }}
              className="border-t border-border pt-3"
            />
          )}

          {step !== 3 && availableCredits.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Avoirs disponibles ({formatFCFA(availableCredits.reduce((s, c) => s + c.amount, 0))}
                )
              </div>
              {appliedCredit ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                  <span>
                    {appliedCredit.reference} appliqué · −{formatFCFA(creditDiscount)}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setAppliedCreditId(null)}>
                    Retirer
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {availableCredits.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAppliedCreditId(c.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent/40 transition"
                    >
                      <span className="font-mono">{c.reference}</span>
                      <span className="font-semibold">{formatFCFA(c.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatFCFA(confirmedSummary?.subtotal ?? subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Livraison
                {!confirmedSummary && zone && producerCount > 1
                  ? ` (${producerCount} × ${formatFCFA(feePerDelivery)})`
                  : zone && !confirmedSummary
                    ? ` · zone ${zone.name}`
                    : ""}
              </span>
              <span>{formatFCFA(confirmedSummary?.delivery ?? delivery)}</span>
            </div>
            {(confirmedSummary?.discount ?? promoDiscount) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Remise{!confirmedSummary && promoCode ? ` (${promoCode})` : ""}</span>
                <span>−{formatFCFA(confirmedSummary?.discount ?? promoDiscount)}</span>
              </div>
            )}
            {(confirmedSummary?.creditApplied ?? creditDiscount) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>
                  Avoir{!confirmedSummary && appliedCredit ? ` (${appliedCredit.reference})` : ""}
                </span>
                <span>−{formatFCFA(confirmedSummary?.creditApplied ?? creditDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Total</span>
              <span className="text-primary">{formatFCFA(confirmedSummary?.total ?? total)}</span>
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
                <Button onClick={confirm} disabled={hasSuspendedSupplier} className="flex-1 gap-1">
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
