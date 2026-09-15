import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Package,
  Share2,
  Copy,
  Clock,
  MapPin,
  Download,
  LifeBuoy,
  AlertTriangle,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderTracker } from "@/components/restaurant/order-tracker";
import { LiveTrackingMapLazy } from "@/components/maps/live-tracking-map-lazy";
import { useLiveTracking } from "@/hooks/use-live-tracking";
import { useRestaurantOrder, useMissions } from "@/data/store";
import { farmers, products, drivers } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { ORDER_LABEL } from "@/components/farmer/status-badge";

export const Route = createFileRoute("/restaurant/orders/$orderId")({
  head: () => ({ meta: [{ title: "Suivi commande · Restaurant" }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const order = useRestaurantOrder(orderId);
  const missions = useMissions();
  // La mission de livraison réelle liée à cette commande (créée en même
  // temps qu'elle) — tant qu'aucun livreur ne l'a acceptée, il n'existe
  // aucun vrai livreur à afficher, contrairement à l'ancien code qui
  // affichait toujours "Oumar Ba" (drivers[0]) quelle que soit la commande.
  const mission = missions.find((m) => order && m.orderRef === order.reference);
  const driver = mission?.driverId ? drivers.find((d) => d.id === mission.driverId) : null;
  const showMap = order?.status === "delivering" && !!driver;
  const { snapshot } = useLiveTracking({
    trackingId: order?.reference,
    driverName: driver?.name,
    enabled: showMap,
  });

  if (!order)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Commande introuvable
      </div>
    );

  const farmer = farmers.find((f) => f.id === order.farmerId);
  const publicId = `TRK-${order.id
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track/${publicId}`
      : `/track/${publicId}`;
  const etaMinutes = snapshot?.etaMinutes ?? mission?.estimatedMinutes ?? null;
  const progress = snapshot?.progress ?? 0;

  const share = async () => {
    try {
      if (navigator.share)
        await navigator.share({ title: `Suivi ${order.reference}`, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Lien copié");
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title={order.reference}
        subtitle={`Commandé ${relativeTime(order.createdAt)}`}
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/restaurant/orders">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/restaurant/invoices/$invoiceId" params={{ invoiceId: order.id }}>
                <Download className="h-4 w-4" />
                Télécharger la facture
              </Link>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Lien copié");
              }}
            >
              <Copy className="h-4 w-4" />
              Copier le lien
            </Button>
            <Button className="gap-2" onClick={share}>
              <Share2 className="h-4 w-4" />
              Partager le suivi
            </Button>
          </>
        }
      />

      {showMap && (
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">ETA</span>
            <b>{etaMinutes ?? "—"} min</b>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">Position</span>
            <b>{Math.round(progress * 100)}%</b>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Lien public :</span>
            <code className="font-mono px-2 py-0.5 rounded bg-muted text-[11px]">
              /track/{publicId}
            </code>
            <Link
              to="/track/$publicId"
              params={{ publicId }}
              target="_blank"
              className="text-primary hover:underline"
            >
              Ouvrir
            </Link>
          </div>
        </div>
      )}

      {showMap && (
        <LiveTrackingMapLazy
          trackingId={order.reference}
          driverName={driver?.name ?? ""}
          minHeight={360}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OrderTracker status={order.status} eta={order.eta} />

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historique de la commande
            </h3>
            <div className="space-y-2">
              {order.statusHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="font-medium">{ORDER_LABEL[h.status]}</span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {new Date(h.at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Articles commandés
            </h3>
            <div className="space-y-2">
              {order.items.map((it, i) => {
                const p = products.find((x) => x.id === it.productId);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border"
                  >
                    <img src={p?.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p?.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {it.qty} {p?.unit} × {formatFCFA(it.price)}
                      </div>
                    </div>
                    <span className="font-bold text-sm">{formatFCFA(it.qty * it.price)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between items-center font-bold text-lg border-t border-border pt-3">
              <span>Total</span>
              <span className="text-primary">{formatFCFA(order.total)}</span>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5 flex flex-wrap items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-[200px]">
              <div className="text-sm font-semibold">Un problème avec cette commande ?</div>
              <div className="text-xs text-muted-foreground">
                Signalez un souci de qualité, quantité, livraison ou paiement.
              </div>
            </div>
            <Button asChild variant="destructive" size="sm" className="gap-2">
              <Link to="/restaurant/orders/$orderId/dispute" params={{ orderId: order.id }}>
                Signaler un problème
              </Link>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3">PRODUCTEUR</div>
            <div className="flex items-center gap-3">
              <img src={farmer?.avatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
              <div className="flex-1">
                <div className="font-semibold text-sm">{farmer?.farm}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>{farmer?.city}</span>
                  {farmer?.rating != null && <span>★ {farmer.rating}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {farmer?.phone && (
                <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                  <a href={`tel:${farmer.phone}`} aria-label={`Appeler ${farmer.farm}`}>
                    <Phone className="h-3.5 w-3.5" />
                    Appeler
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                <Link to="/restaurant/messages">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message
                </Link>
              </Button>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-3">LIVREUR</div>
            {driver ? (
              <>
                <div className="flex items-center gap-3">
                  <img src={driver.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{driver.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {driver.vehicle} · ★ {driver.rating}
                    </div>
                  </div>
                </div>
                {driver.phone && (
                  <Button variant="outline" size="sm" className="w-full mt-3 gap-1" asChild>
                    <a href={`tel:${driver.phone}`} aria-label={`Appeler ${driver.name}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Contacter le livreur
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {["delivered", "cancelled"].includes(order.status)
                  ? "Aucun livreur n'a été assigné à cette commande."
                  : "Aucun livreur assigné pour l'instant — un livreur va bientôt accepter la mission de livraison."}
              </p>
            )}
          </div>

          <div className="glass rounded-2xl p-4 space-y-2 text-sm">
            <div className="text-xs font-semibold text-muted-foreground mb-2">LIVRAISON</div>
            <div>
              <span className="text-muted-foreground">Adresse:</span>{" "}
              <span className="font-medium">{order.deliveryAddress}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Paiement:</span>{" "}
              <span className="font-medium">{order.paymentMethod}</span>
            </div>
            {order.eta && (
              <div>
                <span className="text-muted-foreground">ETA:</span>{" "}
                <span className="font-medium text-primary">{order.eta}</span>
              </div>
            )}
          </div>

          <Button asChild variant="outline" className="w-full gap-2">
            <Link to="/restaurant/support">
              <LifeBuoy className="h-4 w-4" />
              Contacter le support
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
