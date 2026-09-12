import type { OrderStatus } from "@/data/mocks";

type Variant = "order" | "stock" | "payment" | "generic";

const ORDER_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "Préparation",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const ORDER_TONES: Record<OrderStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  confirmed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  preparing: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  delivering: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

const STOCK_TONES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  low: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  out: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  draft: "bg-muted text-muted-foreground border-border",
};

const STOCK_LABELS: Record<string, string> = {
  active: "Actif",
  low: "Stock bas",
  out: "Rupture",
  draft: "Brouillon",
};

const PAYMENT_TONES: Record<string, string> = {
  Effectué: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "En cours": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Échec: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

export function StatusBadge({
  status,
  variant = "order",
  className = "",
}: {
  status: string;
  variant?: Variant;
  className?: string;
}) {
  let tone = "bg-muted text-muted-foreground border-border";
  let label = status;
  if (variant === "order" && status in ORDER_TONES) {
    tone = ORDER_TONES[status as OrderStatus];
    label = ORDER_LABELS[status as OrderStatus];
  } else if (variant === "stock" && status in STOCK_TONES) {
    tone = STOCK_TONES[status];
    label = STOCK_LABELS[status] ?? status;
  } else if (variant === "payment" && status in PAYMENT_TONES) {
    tone = PAYMENT_TONES[status];
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
