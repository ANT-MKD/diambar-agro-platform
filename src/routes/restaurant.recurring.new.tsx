import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Star,
  MapPin,
  Check,
  Minus,
  Plus,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  AlertTriangle,
  PackageX,
  Wallet,
  CalendarOff,
  Truck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useProducts,
  useAllProductReviews,
  useRestaurantProfile,
  useRestaurantOrders,
  recurringOrderActions,
} from "@/data/store";
import {
  farmers,
  type PaymentMethod,
  type PriceRuleAction,
  type StockRuleAction,
  type BudgetRuleAction,
  type HolidayRuleAction,
  type RecurringFrequency,
} from "@/data/mocks";
import { CATEGORIES } from "@/components/farmer/product-form";
import { formatFCFA } from "@/lib/format";
import { farmerReviewStats } from "@/lib/farmer-stats";
import { useReviews as useBusinessReviews } from "@/data/business";
import { deliveryFeeFor } from "@/data/store";

export const Route = createFileRoute("/restaurant/recurring/new")({
  head: () => ({ meta: [{ title: "Nouvelle commande récurrente · Restaurant" }] }),
  component: NewRecurringOrder,
});

const STEPS = ["Fournisseur", "Produits", "Planification", "Règles", "Livraison"];
const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const PAY: PaymentMethod[] = ["Wave", "Orange Money", "Free Money", "Espèces"];

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function NewRecurringOrder() {
  const navigate = useNavigate();
  const products = useProducts();
  const reviews = useAllProductReviews();
  const businessReviews = useBusinessReviews();
  const profile = useRestaurantProfile();
  const restaurantOrders = useRestaurantOrders();

  const [step, setStep] = useState(0);

  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");

  const [items, setItems] = useState<{ productId: string; qty: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [category, setCategory] = useState<string>("Toutes");

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<RecurringFrequency>("weekly");
  const [intervalDays, setIntervalDays] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [createTime, setCreateTime] = useState("08:00");
  const [firstRunAt, setFirstRunAt] = useState(todayISODate());
  const [deliverySlot, setDeliverySlot] = useState("14:00 – 16:00");
  const [endType, setEndType] = useState<"never" | "on_date" | "after_count">("never");
  const [endDate, setEndDate] = useState(todayISODate());
  const [endCount, setEndCount] = useState(24);

  const [priceThreshold, setPriceThreshold] = useState(10);
  const [onPriceIncrease, setOnPriceIncrease] = useState<PriceRuleAction>("ask_confirmation");
  const [onOutOfStock, setOnOutOfStock] = useState<StockRuleAction>("ask_confirmation");
  const [maxBudget, setMaxBudget] = useState(150000);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [onBudgetExceeded, setOnBudgetExceeded] = useState<BudgetRuleAction>("ask_confirmation");
  const [onNonBusinessDay, setOnNonBusinessDay] = useState<HolidayRuleAction>("day_after");

  const [deliveryAddress, setDeliveryAddress] = useState(profile.deliveryAddress);
  const [deliveryMode, setDeliveryMode] = useState<"standard" | "express">("standard");
  const [instructions, setInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(profile.paymentMethod);

  const farmerStats = useMemo(() => {
    return farmers.map((f) => {
      const farmerProducts = products.filter((p) => p.farmerId === f.id);
      const available = farmerProducts.filter((p) => p.status !== "out" && p.status !== "draft");
      const { avgRating, reviewCount } = farmerReviewStats(
        f.id,
        products,
        reviews,
        f.rating,
        businessReviews,
      );
      return {
        farmer: f,
        available: available.length,
        reviewCount,
        avgRating,
      };
    });
  }, [products, reviews, businessReviews]);

  const filteredFarmers = farmerStats.filter((s) =>
    `${s.farmer.farm} ${s.farmer.city}`.toLowerCase().includes(supplierSearch.toLowerCase()),
  );

  const farmerProducts = products.filter(
    (p) => p.farmerId === farmerId && p.status !== "out" && p.status !== "draft",
  );
  const filteredProducts = farmerProducts
    .filter((p) => category === "Toutes" || p.category === category)
    .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const setQty = (productId: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.productId !== productId);
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, qty } : i));
      return [...prev, { productId, qty }];
    });
  };

  const subtotal = items.reduce((s, i) => {
    const p = products.find((x) => x.id === i.productId);
    return s + (p?.pricePerKg ?? 0) * i.qty;
  }, 0);
  const deliveryFee = deliveryFeeFor(deliveryAddress);
  const total = subtotal + deliveryFee;

  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  const farmerHistory = useMemo(
    () => (farmerId ? restaurantOrders.filter((o) => o.farmerId === farmerId) : []),
    [farmerId, restaurantOrders],
  );
  // Suggestion réelle : basée sur la moyenne des vraies commandes passées
  // auprès de ce producteur (avec une marge de 20%), ou à défaut sur le
  // panier actuel — jamais un chiffre inventé.
  const suggestedBudget = useMemo(() => {
    const base =
      farmerHistory.length > 0
        ? farmerHistory.reduce((s, o) => s + o.total, 0) / farmerHistory.length
        : total;
    const margin = farmerHistory.length > 0 ? 1.2 : 1.3;
    return Math.max(5000, Math.ceil((base * margin) / 5000) * 5000);
  }, [farmerHistory, total]);

  useEffect(() => {
    if (step === 3 && !budgetTouched && items.length > 0) {
      setMaxBudget(suggestedBudget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const canGoStep1 = !!farmerId;
  const canGoStep2 = items.length > 0;
  const canGoStep3 =
    daysOfWeek.length > 0 || frequency === "monthly" || frequency === "every_n_days";

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const create = () => {
    const finalName = name.trim() || `Approvisionnement ${selectedFarmer?.farm ?? ""}`;
    const finalItems = items.map((i) => ({
      productId: i.productId,
      qty: i.qty,
      referencePrice: products.find((p) => p.id === i.productId)?.pricePerKg ?? 0,
    }));
    const first = new Date(firstRunAt);
    const [h, m] = createTime.split(":").map(Number);
    first.setHours(h, m, 0, 0);

    recurringOrderActions.create({
      name: finalName,
      farmerId: farmerId!,
      items: finalItems,
      frequency,
      intervalDays: frequency === "every_n_days" ? intervalDays : undefined,
      daysOfWeek: frequency === "monthly" || frequency === "every_n_days" ? [] : daysOfWeek,
      createTime,
      deliverySlot,
      firstRunAt: first.toISOString(),
      end:
        endType === "never"
          ? { type: "never" }
          : endType === "on_date"
            ? { type: "on_date", date: new Date(endDate).toISOString() }
            : { type: "after_count", count: endCount },
      rules: {
        priceIncreaseThresholdPct: priceThreshold,
        onPriceIncrease,
        onOutOfStock,
        maxBudget,
        onBudgetExceeded,
        onNonBusinessDay,
      },
      deliveryAddress,
      deliveryMode,
      instructions: instructions.trim() || undefined,
      paymentMethod,
    });
    toast.success("Commande récurrente créée");
    navigate({ to: "/restaurant/recurring" });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Nouvelle commande récurrente"
        subtitle="Configurez votre commande récurrente en quelques étapes."
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/restaurant/recurring" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux commandes
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {step > i ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${step >= i ? "" : "text-muted-foreground"}`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${step > i ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold">Choisissez votre fournisseur</h3>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Rechercher un agriculteur…"
                className="pl-9"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredFarmers.map(({ farmer: f, available, reviewCount, avgRating }) => (
                <button
                  key={f.id}
                  onClick={() => setFarmerId(f.id)}
                  className={`text-left rounded-2xl border p-4 space-y-2 transition ${farmerId === f.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:bg-accent/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <img src={f.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    {farmerId === f.id && (
                      <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-sm">{f.farm}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {f.city}, Sénégal
                  </div>
                  <div className="text-[11px] flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {avgRating.toFixed(1)}
                    <span className="text-muted-foreground">· {reviewCount} avis</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {available} produits disponibles
                  </div>
                </button>
              ))}
            </div>
            {selectedFarmer && (
              <div className="glass-strong rounded-xl p-3 flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div className="text-sm">
                  <span className="text-muted-foreground">Fournisseur sélectionné : </span>
                  <b>{selectedFarmer.farm}</b>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid lg:grid-cols-[1fr_280px] gap-6">
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold">Que souhaitez-vous commander ?</h3>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Rechercher un produit…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Toutes", ...CATEGORIES].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${category === c ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Aucun produit disponible pour ce fournisseur dans cette catégorie.
                  </p>
                )}
                {filteredProducts.map((p) => {
                  const qty = items.find((i) => i.productId === p.id)?.qty ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border"
                    >
                      <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatFCFA(p.pricePerKg)} / {p.unit} · {p.stock} {p.unit} en stock
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-lg border border-border shrink-0">
                        <button
                          onClick={() => setQty(p.id, Math.max(0, qty - 1))}
                          className="h-8 w-8 grid place-items-center hover:bg-accent"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                        <button
                          onClick={() => setQty(p.id, Math.min(p.stock, qty + 1))}
                          className="h-8 w-8 grid place-items-center hover:bg-accent"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="glass-strong rounded-2xl p-4 h-fit space-y-3">
              <h4 className="font-display font-bold text-sm">Votre commande</h4>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun produit sélectionné.</p>
              )}
              <div className="space-y-1.5">
                {items.map((i) => {
                  const p = products.find((x) => x.id === i.productId);
                  return (
                    <div key={i.productId} className="flex justify-between text-xs">
                      <span>
                        {p?.name} — {i.qty}
                        {p?.unit}
                      </span>
                      <span className="font-medium">
                        {formatFCFA((p?.pricePerKg ?? 0) * i.qty)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatFCFA(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison estimée</span>
                  <span>{formatFCFA(deliveryFee)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1">
                  <span>Total estimé</span>
                  <span className="text-primary">{formatFCFA(total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="font-display text-lg font-bold">
              Quand voulez-vous recevoir cette commande ?
            </h3>
            <div className="space-y-1.5">
              <Label>Nom de la commande récurrente</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Approvisionnement ${selectedFarmer?.farm ?? ""}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fréquence</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {(
                  [
                    ["weekly", "Une fois par semaine"],
                    ["biweekly", "Toutes les 2 semaines"],
                    ["monthly", "Tous les mois"],
                    ["every_n_days", "Tous les X jours"],
                    ["custom", "Personnalisée"],
                  ] as [RecurringFrequency, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFrequency(val)}
                    className={`p-3 rounded-xl border text-left text-sm transition ${frequency === val ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {frequency === "every_n_days" && (
              <div className="space-y-1.5">
                <Label>Répéter chaque (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value)))}
                  className="w-32"
                />
              </div>
            )}

            {(frequency === "weekly" || frequency === "biweekly" || frequency === "custom") && (
              <div className="space-y-1.5">
                <Label>Le(s)</Label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`h-10 w-10 rounded-full text-sm font-semibold border ${daysOfWeek.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Heure de création de la commande
                </Label>
                <Input
                  type="time"
                  value={createTime}
                  onChange={(e) => setCreateTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Date de première commande
                </Label>
                <Input
                  type="date"
                  value={firstRunAt}
                  onChange={(e) => setFirstRunAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Créneau de livraison souhaité</Label>
              <Input
                value={deliverySlot}
                onChange={(e) => setDeliverySlot(e.target.value)}
                placeholder="14:00 – 16:00"
              />
              <p className="text-[11px] text-muted-foreground">
                La commande sera créée à {createTime} pour une livraison souhaitée sur ce créneau.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Fin de la récurrence</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                <button
                  onClick={() => setEndType("never")}
                  className={`p-3 rounded-xl border text-sm ${endType === "never" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  Jamais
                </button>
                <button
                  onClick={() => setEndType("on_date")}
                  className={`p-3 rounded-xl border text-sm ${endType === "on_date" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  À une date
                </button>
                <button
                  onClick={() => setEndType("after_count")}
                  className={`p-3 rounded-xl border text-sm ${endType === "after_count" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  Après X commandes
                </button>
              </div>
              {endType === "on_date" && (
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-48"
                />
              )}
              {endType === "after_count" && (
                <Input
                  type="number"
                  min={1}
                  value={endCount}
                  onChange={(e) => setEndCount(Math.max(1, Number(e.target.value)))}
                  className="w-32"
                />
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="font-display text-lg font-bold">Règles de la commande</h3>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Si le prix augmente
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Seuil de hausse :</span>
                <Input
                  type="number"
                  value={priceThreshold}
                  onChange={(e) => setPriceThreshold(Number(e.target.value))}
                  className="w-20"
                />
                <span>%</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {(
                  [
                    ["auto_continue", "Continuer automatiquement"],
                    ["ask_confirmation", "Demander confirmation"],
                    ["suspend", "Suspendre la commande"],
                  ] as [PriceRuleAction, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setOnPriceIncrease(val)}
                    className={`p-2.5 rounded-lg border text-xs ${onPriceIncrease === val ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <PackageX className="h-4 w-4 text-rose-500" />
                Si un produit n'est plus disponible
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {(
                  [
                    ["cancel_item", "Annuler uniquement ce produit"],
                    ["replace_equivalent", "Remplacer par un équivalent"],
                    ["cancel_all", "Annuler toute la commande"],
                    ["ask_confirmation", "Demander confirmation"],
                  ] as [StockRuleAction, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setOnOutOfStock(val)}
                    className={`p-2.5 rounded-lg border text-xs text-left ${onOutOfStock === val ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <Wallet className="h-4 w-4 text-primary" />
                Budget maximum par commande
              </div>
              <Input
                type="number"
                value={maxBudget}
                onChange={(e) => {
                  setBudgetTouched(true);
                  setMaxBudget(Math.max(0, Number(e.target.value)));
                }}
                className="w-40"
              />
              <p className="text-[11px] text-muted-foreground">
                {farmerHistory.length > 0
                  ? `Suggéré à partir de vos ${farmerHistory.length} commande(s) précédente(s) avec ${selectedFarmer?.farm ?? "ce producteur"}.`
                  : `Suggéré à partir du panier actuel (aucun historique avec ${selectedFarmer?.farm ?? "ce producteur"}).`}
              </p>
              <div className="grid sm:grid-cols-3 gap-2">
                {(
                  [
                    ["ask_confirmation", "Demander confirmation"],
                    ["cancel", "Annuler"],
                    ["reduce_quantities", "Réduire les quantités"],
                  ] as [BudgetRuleAction, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setOnBudgetExceeded(val)}
                    className={`p-2.5 rounded-lg border text-xs ${onBudgetExceeded === val ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-sm">
                <CalendarOff className="h-4 w-4 text-muted-foreground" />
                Si la date tombe un jour non ouvré
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                {(
                  [
                    ["day_before", "Commander le jour précédent"],
                    ["day_after", "Commander le jour suivant"],
                    ["ask_confirmation", "Demander confirmation"],
                  ] as [HolidayRuleAction, string][]
                ).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setOnNonBusinessDay(val)}
                    className={`p-2.5 rounded-lg border text-xs ${onNonBusinessDay === val ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h3 className="font-display text-lg font-bold">Livraison et paiement</h3>
            <div className="space-y-1.5">
              <Label>Adresse de livraison</Label>
              <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode de livraison</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setDeliveryMode("standard")}
                  className={`p-3 rounded-xl border text-left text-sm flex items-center gap-2 ${deliveryMode === "standard" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Truck className="h-4 w-4" /> Livraison standard
                </button>
                <button
                  onClick={() => setDeliveryMode("express")}
                  className={`p-3 rounded-xl border text-left text-sm flex items-center gap-2 ${deliveryMode === "express" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Zap className="h-4 w-4" /> Livraison express
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                La livraison express marque la mission du livreur en priorité.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Instructions (optionnel)</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Livrer à l'entrée principale du restaurant."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {PAY.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`p-3 rounded-xl border text-left text-sm ${paymentMethod === m ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Les commandes générées utiliseront ce mode de paiement.
              </p>
            </div>

            <div className="rounded-2xl border border-border p-4 space-y-2 bg-muted/20">
              <h4 className="font-display font-bold text-sm">Vérifiez votre commande récurrente</h4>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Fournisseur : </span>
                  <b>{selectedFarmer?.farm}</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Produits : </span>
                  {items
                    .map((i) => {
                      const p = products.find((x) => x.id === i.productId);
                      return `${p?.name} — ${i.qty}${p?.unit}`;
                    })
                    .join(", ")}
                </div>
                <div>
                  <span className="text-muted-foreground">Fréquence : </span>
                  {frequency === "monthly"
                    ? "Chaque mois"
                    : frequency === "every_n_days"
                      ? `Tous les ${intervalDays} jours`
                      : `Chaque ${daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}`}
                </div>
                <div>
                  <span className="text-muted-foreground">Première commande : </span>
                  {new Date(firstRunAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}
                </div>
                <div>
                  <span className="text-muted-foreground">Livraison : </span>
                  {deliverySlot} · {deliveryMode === "express" ? "Express" : "Standard"}
                </div>
                <div>
                  <span className="text-muted-foreground">Budget maximum : </span>
                  {formatFCFA(maxBudget)}
                </div>
                <div>
                  <span className="text-muted-foreground">Total estimé par commande : </span>
                  <b className="text-primary">{formatFCFA(total)}</b>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate({ to: "/restaurant/recurring" })}>
            Annuler
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !canGoStep1) ||
              (step === 1 && !canGoStep2) ||
              (step === 2 && !canGoStep3)
            }
            className="gap-2"
          >
            Suivant <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={create} className="gap-2">
            <Check className="h-4 w-4" />
            Créer la commande récurrente
          </Button>
        )}
      </div>
    </div>
  );
}
