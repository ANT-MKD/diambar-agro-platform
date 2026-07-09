import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Truck, Wallet, MessageSquare, Settings as SettingsIcon, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { useDriverNotifications, driverNotifActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/driver/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Livreur" }] }),
  component: DriverNotifications,
});

const ICONS = { order: Truck, payment: Wallet, message: MessageSquare, system: SettingsIcon };

function DriverNotifications() {
  const items = useDriverNotifications();
  const navigate = useNavigate();
  const unread = items.filter((n) => !n.read).length;

  const groupOf = (iso: string) => {
    const now = new Date();
    const d = new Date(iso);
    const diff = (now.getTime() - d.getTime()) / 86400000;
    if (diff < 1 && d.getDate() === now.getDate()) return "Aujourd'hui";
    if (diff < 2) return "Hier";
    if (diff < 7) return "Cette semaine";
    return "Plus ancien";
  };
  const groups = items.reduce<Record<string, typeof items>>((acc, n) => {
    const g = groupOf(n.at);
    (acc[g] ??= []).push(n);
    return acc;
  }, {});

  const go = (n: (typeof items)[number]) => {
    driverNotifActions.markRead(n.id);
    if (n.type === "order") navigate({ to: "/driver/missions" });
    else if (n.type === "payment") navigate({ to: "/driver/earnings" });
    else if (n.type === "message") navigate({ to: "/driver/messages" });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} non lue(s)`}
        actions={<Button variant="outline" onClick={() => driverNotifActions.markAllRead()} className="gap-2"><CheckCheck className="h-4 w-4" />Tout marquer lu</Button>}
      />
      {Object.entries(groups).map(([label, list]) => (
        <div key={label} className="space-y-2">
          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="glass rounded-2xl divide-y divide-border">
            {list.map((n) => {
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
      ))}
    </div>
  );
}