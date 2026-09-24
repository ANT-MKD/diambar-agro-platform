import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X, Phone, Truck, Package2, Flag, Clock, Scale } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { useOrder, orderActions } from "@/data/store";
import { restaurants, drivers, products, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farmer/orders/$orderId")({
  head: () => ({ meta: [{ title: "Commande · Diambar Agro" }] }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
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
            const p = products.find((x) => x.id === it.productId);
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

      <div className="flex flex-wrap gap-2 sticky bottom-0 bg-background/80 backdrop-blur p-3 rounded-xl">
        {order.status === "pending" && (
          <Button onClick={() => next("confirmed")} className="gap-1">
            <Check className="h-4 w-4" />
            Accepter la commande
          </Button>
        )}
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
