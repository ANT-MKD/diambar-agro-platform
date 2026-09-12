import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { OrderStatusBadge } from "./status-badge";
import { restaurants, products, type Order } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export function OrderCard({ order, compact = false }: { order: Order; compact?: boolean }) {
  const r = restaurants.find((x) => x.id === order.restaurantId);
  return (
    <Link
      to="/farmer/orders/$orderId"
      params={{ orderId: order.id }}
      className="block glass rounded-2xl p-4 hover:scale-[1.01] transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={r?.avatar} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{r?.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{order.reference}</div>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      {!compact && (
        <div className="mt-3 text-xs text-muted-foreground line-clamp-2">
          {order.items.map((it, i) => {
            const p = products.find((x) => x.id === it.productId);
            return (
              <span key={i}>
                {i > 0 ? " · " : ""}
                {p?.name} ×{it.qty}
                {p?.unit}
              </span>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {relativeTime(order.createdAt)}
        </span>
        <span className="font-display text-base font-bold text-primary">
          {formatFCFA(order.total)}
        </span>
      </div>
    </Link>
  );
}
