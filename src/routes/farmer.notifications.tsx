import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Package, CreditCard, Warehouse, Info, MessageSquare, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { notifications as seed, type AppNotification } from "@/data/mocks";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/farmer/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Diambar Agro" }] }),
  component: NotificationsPage,
});

const ICONS = { order: Package, payment: CreditCard, stock: Warehouse, system: Info, message: MessageSquare };
const TONES: Record<AppNotification["type"], string> = {
  order: "bg-blue-500/10 text-blue-500",
  payment: "bg-emerald-500/10 text-emerald-500",
  stock: "bg-amber-500/10 text-amber-500",
  system: "bg-violet-500/10 text-violet-500",
  message: "bg-rose-500/10 text-rose-500",
};

function group(list: AppNotification[]) {
  const today: AppNotification[] = [], week: AppNotification[] = [], older: AppNotification[] = [];
  const now = Date.now();
  list.forEach((n) => {
    const diff = (now - new Date(n.at).getTime()) / 86400000;
    if (diff < 1) today.push(n);
    else if (diff < 7) week.push(n);
    else older.push(n);
  });
  return { today, week, older };
}

function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>(seed);
  const [filter, setFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState({
    order: { email: true, sms: true, push: true },
    payment: { email: true, sms: false, push: true },
    stock: { email: false, sms: false, push: true },
    message: { email: false, sms: false, push: true },
    system: { email: true, sms: false, push: false },
  });

  const list = items.filter((n) => filter === "all" || n.type === filter);
  const g = group(list);
  const unread = items.filter((n) => !n.read).length;

  const markAll = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));

  const Section = ({ title, list }: { title: string; list: AppNotification[] }) => list.length === 0 ? null : (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</div>
      <div className="glass rounded-2xl divide-y divide-border">
        {list.map((n) => {
          const Icon = ICONS[n.type];
          return (
            <div key={n.id} className={`p-4 flex items-start gap-3 ${!n.read ? "bg-primary/5" : ""}`}>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${TONES[n.type]}`}><Icon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{n.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(n.at)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
              </div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-2" />}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={`${unread} non lue(s)`} actions={
        <Button variant="outline" onClick={markAll} className="gap-2"><CheckCheck className="h-4 w-4" />Tout marquer lu</Button>
      } />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="order">Commandes</TabsTrigger>
          <TabsTrigger value="payment">Paiements</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="message">Messages</TabsTrigger>
          <TabsTrigger value="system">Système</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Section title="Aujourd'hui" list={g.today} />
          <Section title="Cette semaine" list={g.week} />
          <Section title="Plus ancien" list={g.older} />
          {list.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Aucune notification pour ce filtre.
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 h-fit">
          <h3 className="font-semibold">Préférences</h3>
          <p className="text-xs text-muted-foreground mt-1">Canaux d'envoi par catégorie</p>
          <div className="mt-4 space-y-4">
            {(Object.keys(prefs) as Array<keyof typeof prefs>).map((k) => (
              <div key={k} className="rounded-xl border border-border p-3">
                <div className="text-sm font-medium capitalize mb-3">{k}</div>
                <div className="space-y-2">
                  {(["email", "sms", "push"] as const).map((ch) => (
                    <div key={ch} className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-wider text-muted-foreground">{ch}</span>
                      <Switch checked={prefs[k][ch]} onCheckedChange={(v) => setPrefs({ ...prefs, [k]: { ...prefs[k], [ch]: v } })} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
