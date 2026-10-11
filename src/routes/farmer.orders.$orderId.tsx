import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X, Phone, Truck, Package2, Flag, Clock, Scale } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { useOrder, orderActions, useProducts } from "@/data/store";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restaurants, drivers, products, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { HandoverCode } from "@/components/common/handover-code";
import { whatsappLink } from "@/lib/contact";

export const Route = createFileRoute("/farmer/orders/$orderId")({
  head: () => ({ meta: [{ title: "Commande · Diambar Agro" }] }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
  const liveProducts = useProducts();
  if (!order)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Commande introuvable
      </div>
    );

  const r = restaurants.find((x) => x.id === order.restaurantId);
  const d = order.driverId ? drivers.find((x) => x.id === order.driverId) : null;
  const steps: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "delivered"];
  const idx = steps.indexOf(order.status);

  const next = (s: OrderStatus) => {
    const result = orderActions.setStatus(order.id, s);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      s === "confirmed"
        ? "Commande acceptée · une mission de livraison est ouverte aux livreurs"
        : `Commande ${ORDER_LABEL[s].toLowerCase()}`,
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={order.reference}
        subtitle={`Créée ${relativeTime(order.createdAt)}`}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/farmer/orders">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <div className="flex items-center justify-between glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <img src={r?.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
          <div>
            <div className="font-semibold">{r?.name}</div>
            <div className="text-xs text-muted-foreground">
              {r?.city} · {r?.type}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.eta && !["delivered", "cancelled"].includes(order.status) && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              ETA {order.eta}
            </span>
          )}
          <OrderStatusBadge status={order.status} />
          {r?.phone && (
            <Button size="icon" variant="outline" asChild>
              <a href={`tel:${r.phone}`} aria-label={`Appeler ${r.name}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
          {r?.phone && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={whatsappLink(r.phone, `Bonjour, à propos de la commande ${order.reference}.`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-xs font-semibold text-muted-foreground mb-3">PROGRESSION</div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
              <div className="text-[10px] mt-1 text-center text-muted-foreground">
                {ORDER_LABEL[s]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-xs font-semibold text-muted-foreground mb-3">ARTICLES</div>
        <div className="space-y-2">
          {order.items.map((it, i) => {
            const p = liveProducts.find((x) => x.id === it.productId);
            return (
              <div
                key={i}
                className="flex items-center gap-3 justify-between text-sm rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {p?.image && (
                    <img
                      src={p.image}
                      alt=""
                      className="h-9 w-9 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <span className="truncate">
                    {p?.name}{" "}
                    <span className="text-muted-foreground">
                      ×{it.qty}
                      {p?.unit}
                    </span>
                  </span>
                </div>
                <span className="font-medium shrink-0">{formatFCFA(it.qty * it.price)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">{formatFCFA(order.total)}</span>
        </div>
      </div>

      {d && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <img src={d.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          <div className="flex-1">
            <div className="font-medium text-sm">{d.name}</div>
            <div className="text-xs text-muted-foreground">
              {d.vehicle} · ★ {d.rating}
            </div>
          </div>
        </div>
      )}

      {order.pickupCode && (order.status === "confirmed" || order.status === "preparing") && (
        <HandoverCode
          code={order.pickupCode}
          title="Code d'enlèvement"
          hint="À donner au livreur quand il récupère la marchandise, jamais avant."
        />
      )}

      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background/80 backdrop-blur p-3 rounded-xl">
        {order.status === "pending" && (
          <Button onClick={() => next("confirmed")} className="gap-1">
            <Check className="h-4 w-4" />
            Accepter la commande
          </Button>
        )}
        {order.status === "pending" && <AdjustQuantities orderId={order.id} />}
        {order.status === "confirmed" && (
          <Button onClick={() => next("preparing")} className="gap-1">
            <Package2 className="h-4 w-4" />
            Commencer la préparation
          </Button>
        )}
        {(order.status === "confirmed" || order.status === "preparing") && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground self-center">
            <Truck className="h-4 w-4" />
            Le livreur passera récupérer la commande : c'est son enlèvement qui la met « en
            livraison ».
          </p>
        )}
        {order.status === "delivering" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground self-center">
            <Truck className="h-4 w-4" />
            En route vers le restaurant · la livraison sera confirmée par le livreur, puis la vente
            créditée sur vos revenus.
          </p>
        )}
        {["pending", "confirmed", "preparing"].includes(order.status) && (
          <Button asChild variant="outline" className="gap-1 text-rose-500">
            <Link to="/farmer/orders/$orderId/refuse" params={{ orderId: order.id }}>
              <X className="h-4 w-4" />
              Refuser
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="gap-1 ml-auto">
          <Link to="/farmer/orders/$orderId/report" params={{ orderId: order.id }}>
            <Flag className="h-4 w-4" />
            Signaler
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-1">
          <Link to="/farmer/orders/$orderId/dispute" params={{ orderId: order.id }}>
            <Scale className="h-4 w-4" />
            Ouvrir un litige
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Le producteur n'a pas tout : il accepte avec les quantités réellement
 * disponibles (le restaurant est remboursé de la différence, ou la commande
 * est annulée selon son choix). */
function AdjustQuantities({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);
  const allProducts = useProducts();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  if (!order) return null;
  const submit = () => {
    const result = orderActions.confirmPartial(order.id, qty);
    if (!result.ok) return toast.error(result.message);
    toast.success("Commande acceptée avec les quantités disponibles");
    setOpen(false);
  };
  return (
    <>
      <Button variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        Accepter en partie
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantités disponibles</DialogTitle>
            <DialogDescription>
              Indiquez ce que vous pouvez vraiment livrer. Le restaurant est prévenu et remboursé de
              la différence (ou la commande est annulée s'il l'a demandé).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {order.items.map((it) => {
              const p = allProducts.find((x) => x.id === it.productId);
              return (
                <label
                  key={it.productId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {p?.name ?? it.productId}{" "}
                    <span className="text-xs text-muted-foreground">
                      (commandé : {it.qty} {p?.unit})
                    </span>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={it.qty}
                    value={qty[it.productId] ?? it.qty}
                    onChange={(e) =>
                      setQty((q) => ({
                        ...q,
                        [it.productId]: Math.min(it.qty, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="h-11 w-24 rounded-lg border border-input bg-background px-3"
                  />
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>Accepter ces quantités</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
