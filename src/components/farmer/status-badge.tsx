import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/data/mocks";

const ORDER_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const ORDER_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  confirmed: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  preparing: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  delivering: "bg-primary/15 text-primary border-primary/30",
  delivered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", ORDER_TONE[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_LABEL[status]}
    </span>
  );
}

export function StockStatusBadge({ status }: { status: "active" | "low" | "out" | "draft" }) {
  const tone =
    status === "active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
    status === "low" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
    status === "out" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" :
    "bg-muted text-muted-foreground border-border";
  const label = status === "active" ? "En stock" : status === "low" ? "Stock faible" : status === "out" ? "Rupture" : "Brouillon";
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tone)}>{label}</span>;
}

export { ORDER_LABEL };