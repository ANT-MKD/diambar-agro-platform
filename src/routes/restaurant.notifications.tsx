import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, ShoppingBag, Wallet, AlertTriangle, MessageSquare, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { useRestaurantNotifications, restaurantNotifActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Restaurant" }] }),
  component: Notifications,
});

const ICONS = { order: ShoppingBag, payment: Wallet, stock: AlertTriangle, message: MessageSquare };

function Notifications() {
  const items = useRestaurantNotifications();
  const navigate = useNavigate();
  const unread = items.filter((n) => !n.read).length;
  const go = (n: (typeof items)[number]) => {
    restaurantNotifActions.markRead(n.id);
    if (n.type === "order") navigate({ to: "/restaurant/orders" });
    else if (n.type === "payment") navigate({ to: "/restaurant/invoices" });
    else if (n.type === "stock") navigate({ to: "/restaurant/marketplace" });
    else if (n.type === "message") navigate({ to: "/restaurant/messages" });
  };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} non lue(s)`}
        actions={<Button variant="outline" onClick={() => restaurantNotifActions.markAllRead()} className="gap-2"><CheckCheck className="h-4 w-4" />Tout marquer lu</Button>}
      />
      <div className="glass rounded-2xl divide-y divide-border">
        {items.map((n) => {
          const Icon = ICONS[n.type as keyof typeof ICONS] ?? Bell;
          return (
            <button key={n.id} onClick={() => go(n)} className={`w-full text-left p-4 flex items-start gap-3 hover:bg-accent/30 transition ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm">{n.title}</div><span className="text-[10px] text-muted-foreground">{relativeTime(n.at)}</span></div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-2" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}