import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, List as ListIcon, Clock } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { useRestaurantOrders } from "@/data/store";
import { farmers, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/orders")({
  head: () => ({ meta: [{ title: "Mes Commandes · Restaurant" }] }),
  component: OrdersPage,
});

const COLS: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "delivered"];

function OrdersPage() {
  const orders = useRestaurantOrders();
  const [view, setView] = useState<"list" | "kanban">("list");

  return (
    <div className="space-y-6">
      <PageHeader title="Mes Commandes" subtitle={`${orders.length} commandes au total`} actions={
        <div className="inline-flex rounded-xl border border-border p-1">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}><ListIcon className="h-3.5 w-3.5" />Liste</button>
          <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1 ${view === "kanban" ? "bg-primary text-primary-foreground" : ""}`}><LayoutGrid className="h-3.5 w-3.5" />Kanban</button>
        </div>
      } />

      {view === "list" ? (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Réf.</th><th className="text-left p-3">Producteur</th><th className="text-left p-3">Articles</th><th className="text-left p-3">Statut</th><th className="text-right p-3">Total</th><th className="text-left p-3">Date</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const f = farmers.find((x) => x.id === o.farmerId);
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-accent/30">
                    <td className="p-3 font-medium"><Link to="/restaurant/orders/$orderId" params={{ orderId: o.id }} className="hover:text-primary">{o.reference}</Link></td>
                    <td className="p-3"><div className="flex items-center gap-2"><img src={f?.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /><span className="text-xs">{f?.farm}</span></div></td>
                    <td className="p-3 text-muted-foreground">{o.items.length} article(s)</td>
                    <td className="p-3"><OrderStatusBadge status={o.status} /></td>
                    <td className="p-3 text-right font-semibold text-primary">{formatFCFA(o.total)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{relativeTime(o.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLS.map((col) => {
            const cards = orders.filter((o) => o.status === col);
            return (
              <div key={col} className="glass rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider">{ORDER_LABEL[col]}</h3>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 font-bold">{cards.length}</span>
                </div>
                {cards.map((o) => {
                  const f = farmers.find((x) => x.id === o.farmerId);
                  return (
                    <Link key={o.id} to="/restaurant/orders/$orderId" params={{ orderId: o.id }} className="block bg-card rounded-xl p-3 border border-border hover:scale-[1.01] transition">
                      <div className="flex items-center gap-2"><img src={f?.avatar} alt="" className="h-7 w-7 rounded-full object-cover" /><span className="text-xs font-semibold">{f?.farm}</span></div>
                      <div className="mt-2 text-[11px] text-muted-foreground">{o.reference} · {o.items.length} art.</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{relativeTime(o.createdAt)}</span>
                        <span className="font-bold text-sm text-primary">{formatFCFA(o.total)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}