import { Check, Package, Truck, MapPin, Clock } from "lucide-react";
import type { OrderStatus } from "@/data/mocks";

const STEPS: { key: OrderStatus; label: string; icon: typeof Check; desc: string }[] = [
  {
    key: "pending",
    label: "Commande reçue",
    icon: Check,
    desc: "Le producteur a reçu votre commande.",
  },
  { key: "confirmed", label: "Confirmée", icon: Check, desc: "Producteur a accepté la commande." },
  {
    key: "preparing",
    label: "Préparation",
    icon: Package,
    desc: "Vos produits sont en cours de préparation.",
  },
  {
    key: "delivering",
    label: "En livraison",
    icon: Truck,
    desc: "Livreur en route vers votre établissement.",
  },
  { key: "delivered", label: "Livrée", icon: MapPin, desc: "Commande livrée avec succès." },
];

export function OrderTracker({ status, eta }: { status: OrderStatus; eta?: string }) {
  const idx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === status),
  );
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg">Suivi de la commande</h3>
        {eta && (
          <div className="flex items-center gap-1.5 text-xs font-medium glass-strong rounded-full px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            ETA {eta}
          </div>
        )}
      </div>
      <ol className="relative space-y-4">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
        <div
          className="absolute left-[15px] top-2 w-px bg-primary transition-all duration-700"
          style={{ height: `${(idx / (STEPS.length - 1)) * 100}%` }}
        />
        {STEPS.map((s, i) => {
          const done = i <= idx;
          const active = i === idx;
          return (
            <li key={s.key} className="relative flex items-start gap-3 pl-2">
              <div
                className={`relative z-10 h-8 w-8 rounded-full grid place-items-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-4 ring-primary/20" : ""}`}
              >
                <s.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 pb-2">
                <div className={`text-sm font-semibold ${done ? "" : "text-muted-foreground"}`}>
                  {s.label}
                </div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              {active && (
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider mt-1">
                  En cours
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
