import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Package,
  CreditCard,
  Warehouse,
  Info,
  MessageSquare,
  Truck,
  CheckCheck,
  Search,
  Trash2,
  MailOpen,
  Mail,
  SlidersHorizontal,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/farmer/page-header";
import { relativeTime } from "@/lib/format";
import type { AppNotification } from "@/data/mocks";

export const NOTIF_ICONS: Record<string, typeof Bell> = {
  order: Package,
  payment: CreditCard,
  stock: Warehouse,
  system: Info,
  message: MessageSquare,
  mission: Truck,
};
export const NOTIF_TONES: Record<string, string> = {
  order: "bg-blue-500/10 text-blue-500",
  payment: "bg-emerald-500/10 text-emerald-500",
  stock: "bg-amber-500/10 text-amber-500",
  system: "bg-violet-500/10 text-violet-500",
  message: "bg-rose-500/10 text-rose-500",
  mission: "bg-sky-500/10 text-sky-500",
};

export type NotifActions = {
  markRead: (id: string) => void;
  markAllRead: () => void;
  toggleRead: (id: string) => void;
  clearRead: () => void;
  remove: (id: string) => void;
};

function groupOf(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (diff < 1) return "Aujourd'hui";
  if (diff < 2) return "Hier";
  if (diff < 7) return "Cette semaine";
  return "Plus ancien";
}

export function NotificationCenter({
  items,
  actions,
  onOpen,
  rulesTo,
  types,
  subtitlePrefix = "Centre de notifications",
}: {
  items: AppNotification[];
  actions: NotifActions;
  onOpen?: (n: AppNotification) => void;
  rulesTo: string;
  types?: { key: string; label: string }[];
  subtitlePrefix?: string;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");

  const typeTabs = useMemo(() => {
    if (types) return types;
    const uniq = Array.from(new Set(items.map((n) => n.type)));
    return uniq.map((t) => ({ key: t, label: t }));
  }, [types, items]);

  const filtered = useMemo(
    () =>
      items.filter((n) => {
        if (type !== "all" && n.type !== type) return false;
        if (status === "unread" && n.read) return false;
        if (status === "read" && !n.read) return false;
        if (q && !`${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [items, type, status, q],
  );

  const groups = useMemo(() => {
    const acc: Record<string, AppNotification[]> = {};
    filtered.forEach((n) => {
      (acc[groupOf(n.at)] ??= []).push(n);
    });
    return acc;
  }, [filtered]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={`${subtitlePrefix} · ${unread} non lue(s) sur ${items.length}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={actions.markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Tout marquer lu
            </Button>
            <Button variant="outline" className="gap-2" onClick={actions.clearRead}>
              <Trash2 className="h-4 w-4" />
              Effacer les lues
            </Button>
            <Button asChild className="gap-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={rulesTo as any}>
                <SlidersHorizontal className="h-4 w-4" />
                Règles
              </Link>
            </Button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une notification…"
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">
              Toutes
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Non lues {unread > 0 && `(${unread})`}
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs">
              Lues
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={type === "all"}
          onClick={() => setType("all")}
          label={`Tous (${items.length})`}
        />
        {typeTabs.map((t) => (
          <FilterChip
            key={t.key}
            active={type === t.key}
            onClick={() => setType(t.key)}
            label={`${t.label} (${items.filter((n) => n.type === t.key).length})`}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Aucune notification</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajustez vos filtres ou revenez plus tard.
          </p>
        </div>
      ) : (
        Object.entries(groups).map(([label, list]) => (
          <div key={label} className="space-y-2">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
              {list.map((n) => {
                const Icon = NOTIF_ICONS[n.type] ?? Bell;
                return (
                  <div
                    key={n.id}
                    className={`group flex items-start gap-3 p-4 transition ${!n.read ? "bg-primary/5" : ""}`}
                  >
                    <button
                      onClick={() => onOpen?.(n)}
                      className="flex flex-1 items-start gap-3 text-left"
                    >
                      <div
                        className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${NOTIF_TONES[n.type] ?? "bg-primary/10 text-primary"}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm truncate">{n.title}</div>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <div className="text-sm text-muted-foreground">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {relativeTime(n.at)}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={n.read ? "Marquer non lue" : "Marquer lue"}
                        onClick={() => actions.toggleRead(n.id)}
                      >
                        {n.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500"
                        title="Supprimer"
                        onClick={() => actions.remove(n.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent/40"
      }`}
    >
      {label}
    </button>
  );
}
