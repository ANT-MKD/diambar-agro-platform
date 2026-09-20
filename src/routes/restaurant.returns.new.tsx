import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/disputes/file-drop";
import { useRestaurantOrders } from "@/data/store";
import { farmers, products, restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import type { DisputeAttachment } from "@/data/disputes";
import { returnActions, RETURN_REASON_LABEL, type ReturnReason } from "@/data/business";

export const Route = createFileRoute("/restaurant/returns/new")({
  head: () => ({ meta: [{ title: "Déclarer un problème · Restaurant" }] }),
  component: NewReturn,
});

const STEPS = ["Commande", "Produit", "Détails", "Confirmation"];
const REASONS = Object.keys(RETURN_REASON_LABEL) as ReturnReason[];

function NewReturn() {
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const orders = useRestaurantOrders();

  const [step, setStep] = useState(0);
  const [q, setQ] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<ReturnReason>("quality");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<DisputeAttachment[]>([]);

  // Seules les commandes réellement livrées peuvent faire l'objet d'un
  // retour — comme dans la maquette, pas de retour possible sur une
  // commande encore en cours.
  const deliveredOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "delivered")
        .filter((o) => o.reference.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, q],
  );

  const order = orders.find((o) => o.id === orderId) ?? null;
  const farmer = order ? farmers.find((f) => f.id === order.farmerId) : null;
  const orderLine = order?.items.find((it) => it.productId === productId) ?? null;
  const product = productId ? products.find((p) => p.id === productId) : null;

  const canGoStep1 = !!orderId;
  const canGoStep2 = !!productId;
  const canGoStep3 =
    Number(qty) > 0 &&
    Number(qty) <= (orderLine?.qty ?? Infinity) &&
    Number(requestedAmount) > 0 &&
    description.trim().length >= 10;

  const submit = () => {
    if (!order || !orderLine || !product || !myRestaurant) return;
    const item = returnActions.create({
      orderRef: order.reference,
      orderId: order.id,
      restaurantId: myRestaurant.id,
      restaurantName: myRestaurant.name,
      productId: product.id,
      productName: product.name,
      qty: Number(qty),
      unit: product.unit,
      reason,
      description: description.trim(),
      requestedAmount: Number(requestedAmount),
      photos,
    });
    toast.success("Demande de retour envoyée au producteur", {
      description: `${item.reference} · ${formatFCFA(item.requestedAmount)}`,
    });
    navigate({ to: "/restaurant/returns/$returnId", params: { returnId: item.id } });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Déclarer un problème sur une livraison"
        subtitle="Sélectionnez la commande concernée et décrivez le problème. Nous nous occupons du reste."
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/restaurant/returns" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
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
            <h3 className="font-display text-lg font-bold">1. Sélectionnez la commande</h3>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une commande (ex: CMD-3049)"
                className="pl-9"
              />
            </div>
            {deliveredOrders.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Aucune commande livrée"
                description="Seules les commandes réellement livrées peuvent faire l'objet d'une demande de retour."
              />
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {deliveredOrders.map((o) => {
                  const f = farmers.find((x) => x.id === o.farmerId);
                  const active = o.id === orderId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOrderId(o.id);
                        setProductId(null);
                      }}
                      className={`w-full text-left rounded-xl border p-3 transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-sm">{o.reference}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                          Livrée
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {f?.farm ?? "—"} · {new Date(o.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                        {formatFCFA(o.total)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 1 && order && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold">2. Sélectionnez le produit concerné</h3>
            <p className="text-xs text-muted-foreground">
              Commande {order.reference} · {farmer?.farm}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {order.items.map((it) => {
                const p = products.find((x) => x.id === it.productId);
                const active = it.productId === productId;
                return (
                  <button
                    key={it.productId}
                    onClick={() => {
                      setProductId(it.productId);
                      setQty(String(it.qty));
                      setRequestedAmount(String(it.qty * it.price));
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}
                  >
                    {p && (
                      <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p?.name ?? it.productId}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.qty} {p?.unit} · {formatFCFA(it.qty * it.price)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && order && orderLine && product && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold">3. Détails du problème</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Quantité concernée (sur {orderLine.qty} {product.unit} commandés)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={orderLine.qty}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Montant réclamé (FCFA)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Motif</label>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${reason === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                    >
                      {RETURN_REASON_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea
                  placeholder="Décrivez le problème constaté à la réception… (10 caractères minimum)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <FileDrop
              value={photos}
              onChange={setPhotos}
              by={myRestaurant?.name ?? user.name}
              kind="photo"
              label="Photos à l'appui (facultatif)"
            />
          </div>
        )}

        {step === 3 && order && orderLine && product && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold">4. Confirmation</h3>
            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Commande</span>
                <span className="font-medium">
                  {order.reference} · {farmer?.farm}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produit</span>
                <span className="font-medium">
                  {product.name} ({qty} {product.unit})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motif</span>
                <span className="font-medium">{RETURN_REASON_LABEL[reason]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant réclamé</span>
                <span className="font-bold">{formatFCFA(Number(requestedAmount) || 0)}</span>
              </div>
              <div className="pt-2 border-t border-border text-muted-foreground">{description}</div>
              {photos.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {photos.length} photo(s) jointe(s)
                </div>
              )}
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
          <Button variant="outline" onClick={() => navigate({ to: "/restaurant/returns" })}>
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
          <Button onClick={submit} className="gap-2">
            <Check className="h-4 w-4" />
            Envoyer la demande
          </Button>
        )}
      </div>
    </div>
  );
}
