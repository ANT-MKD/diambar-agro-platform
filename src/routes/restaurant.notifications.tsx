import { createFileRoute } from "@tanstack/react-router";
import { Bell, ShoppingBag, Wallet, AlertTriangle, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { restaurantNotifications } from "@/data/mocks";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Restaurant" }] }),
  component: Notifications,
});

const ICONS = { order: ShoppingBag, payment: Wallet, stock: AlertTriangle, message: MessageSquare };

function Notifications() {
  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" subtitle={`${restaurantNotifications.filter((n) => !n.read).length} non lues`} />
      <div className="glass rounded-2xl divide-y divide-border">
        {restaurantNotifications.map((n) => {
          const Icon = ICONS[n.type as keyof typeof ICONS] ?? Bell;
          return (
            <div key={n.id} className={`p-4 flex items-start gap-3 hover:bg-accent/30 ${!n.read ? "bg-primary/5" : ""}`}>
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2"><div className="font-semibold text-sm">{n.title}</div><span className="text-[10px] text-muted-foreground">{relativeTime(n.at)}</span></div>
                <div className="text-sm text-muted-foreground">{n.body}</div>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-2" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}