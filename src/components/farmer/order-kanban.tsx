import { Reorder, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { OrderCard } from "./order-card";
import { ORDER_LABEL } from "./status-badge";
import { orderActions } from "@/data/store";
import type { Order, OrderStatus } from "@/data/mocks";

const COLUMNS: { status: OrderStatus; accent: string }[] = [
  { status: "pending", accent: "border-t-amber-500" },
  { status: "confirmed", accent: "border-t-blue-500" },
  { status: "preparing", accent: "border-t-violet-500" },
  { status: "delivering", accent: "border-t-primary" },
];

export function OrderKanban({ orders }: { orders: Order[] }) {
  const buildColumns = (source: Order[]): Record<OrderStatus, Order[]> =>
    COLUMNS.reduce(
      (acc, c) => {
        acc[c.status] = source.filter((o) => o.status === c.status);
        return acc;
      },
      {} as Record<OrderStatus, Order[]>,
    );

  const [columns, setColumns] = useState<Record<OrderStatus, Order[]>>(() => buildColumns(orders));

  useEffect(() => {
    setColumns(buildColumns(orders));
  }, [orders]);

  // Le glisser-déposer suit la même règle que les boutons : uniquement vers
  // l'étape suivante permise au producteur, jamais en arrière.
  const move = (id: string, to: OrderStatus) => {
    const result = orderActions.setStatus(id, to);
    if (!result.ok) toast.error(result.message);
    else toast.success(`Commande passée en « ${ORDER_LABEL[to]} »`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const list = columns[col.status] ?? [];
        return (
          <div
            key={col.status}
            className={`rounded-2xl bg-card/40 border border-border border-t-4 ${col.accent} p-3 flex flex-col min-h-[400px]`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-semibold text-sm">{ORDER_LABEL[col.status]}</h3>
              <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {list.length}
              </span>
            </div>
            <div className="space-y-2 flex-1">
              {list.length === 0 ? (
                <div className="text-center text-[11px] text-muted-foreground/60 py-8">
                  Aucune commande
                </div>
              ) : (
                list.map((o) => (
                  <motion.div
                    key={o.id}
                    layout
                    drag="x"
                    dragSnapToOrigin
                    whileDrag={{ scale: 1.04, zIndex: 50 }}
                    onDragEnd={(_, info) => {
                      if (Math.abs(info.offset.x) < 80) return;
                      const idx = COLUMNS.findIndex((c) => c.status === col.status);
                      if (info.offset.x < 0) {
                        toast.error("Une commande ne revient jamais à une étape précédente.");
                        return;
                      }
                      const next = COLUMNS[idx + 1];
                      if (next) move(o.id, next.status);
                    }}
                  >
                    <OrderCard order={o} compact />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
