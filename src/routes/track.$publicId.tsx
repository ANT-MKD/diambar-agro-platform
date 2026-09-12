import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Truck, CheckCircle2, Package, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { LiveMap, useSimulatedProgress } from "@/components/restaurant/live-map";
import { OrderTracker } from "@/components/restaurant/order-tracker";
import { useRestaurantOrders } from "@/data/store";
import { farmers, drivers } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/track/$publicId")({
  head: ({ params }) => ({ meta: [{ title: `Suivi commande ${params.publicId} · Diambar Agro` }] }),
  component: PublicTracking,
});

// Public IDs use a stable prefix "TRK-" + last 6 chars of the order id, base36.
function publicIdOf(id: string) {
  return `TRK-${id
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
}

function PublicTracking() {
  const { publicId } = Route.useParams();
  const orders = useRestaurantOrders();
  const order = useMemo(
    () => orders.find((o) => publicIdOf(o.id) === publicId.toUpperCase()) ?? orders[0],
    [orders, publicId],
  );
  const progress = useSimulatedProgress(0.35, 0.008, 2000);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!order) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="glass rounded-2xl p-10 text-center max-w-md">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h1 className="font-display font-bold text-xl mb-1">Lien de suivi invalide</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien n'est plus actif ou la commande a été supprimée.
          </p>
        </div>
      </main>
    );
  }

  const farmer = farmers.find((f) => f.id === order.farmerId);
  const driver = drivers[0];
  const etaMinutes = Math.max(1, Math.round((1 - progress) * 30));

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Suivi ${order.reference}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié");
      }
    } catch {
      /* ignore */
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié dans le presse-papier");
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 lg:px-6 h-14">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              Copier
            </Button>
            <Button size="sm" className="gap-2" onClick={share}>
              <Share2 className="h-3.5 w-3.5" />
              Partager
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Suivi public
            </div>
            <h1 className="font-display text-2xl font-bold mt-0.5">{order.reference}</h1>
            <div className="text-xs text-muted-foreground">
              Passée {relativeTime(order.createdAt)} · ID {publicIdOf(order.id)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">Total commande</div>
              <div className="font-bold text-lg text-primary">{formatFCFA(order.total)}</div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <SummaryTile
            icon={CheckCircle2}
            label="Statut"
            value={statusLabel(order.status)}
            tone="emerald"
          />
          <SummaryTile
            icon={Clock}
            label="ETA estimée"
            value={`${etaMinutes} min`}
            tone="primary"
            pulse
          />
          <SummaryTile
            icon={MapPin}
            label="Position"
            value={`${Math.round(progress * 100)}% du trajet`}
            tone="amber"
          />
          <SummaryTile icon={Truck} label="Livreur" value={driver.name} tone="blue" />
        </div>

        <LiveMap
          origin={{ x: 22, y: 70, label: farmer?.farm ?? "" }}
          destination={{ x: 75, y: 25, label: order.deliveryAddress }}
          progress={progress}
          driverName={driver.name}
          height={380}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OrderTracker status={order.status} eta={`${etaMinutes} min`} />
          </div>
          <div className="space-y-3">
            <div className="glass rounded-2xl p-4 text-sm space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">
                Résumé temps réel
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mis à jour</span>
                <span className="font-medium">{now.toLocaleTimeString("fr-FR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Départ</span>
                <span className="font-medium">{farmer?.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arrivée</span>
                <span className="font-medium">{order.deliveryAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distance restante</span>
                <span className="font-medium">
                  {Math.max(1, Math.round((1 - progress) * 42))} km
                </span>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
              Ce lien est public et actualisé en direct. Aucune information sensible (contact
              client, moyens de paiement) n'y est affichée.
            </div>
            <Link
              to="/"
              className="block text-center text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Retour à Diambar Agro
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function statusLabel(s: string) {
  return (
    {
      pending: "Reçue",
      confirmed: "Confirmée",
      preparing: "Préparation",
      delivering: "En livraison",
      delivered: "Livrée",
      cancelled: "Annulée",
    }[s] ?? s
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  tone: "emerald" | "primary" | "amber" | "blue";
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    primary: "text-primary bg-primary/10",
    amber: "text-amber-500 bg-amber-500/10",
    blue: "text-blue-500 bg-blue-500/10",
  };
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl grid place-items-center relative ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
        {pulse && (
          <span className="absolute inset-0 rounded-xl animate-ping bg-current opacity-20" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className="font-bold text-sm truncate">{value}</div>
      </div>
    </div>
  );
}
