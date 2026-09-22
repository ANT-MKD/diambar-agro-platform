import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bell,
  ShieldCheck,
  Scale,
  PackageSearch,
  TriangleAlert,
  Check,
  PackageMinus,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import {
  useAdminNotifications,
  adminNotifActions,
  type AdminNotification,
  type AdminNotificationPriority,
} from "@/data/admin-store";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Centre de notifications : validations, litiges, incidents et signalements en attente.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNotifications,
});

const ICON = {
  validation: ShieldCheck,
  dispute: Scale,
  moderation: PackageSearch,
  incident: TriangleAlert,
  return: PackageMinus,
} as const;

const KIND_LABEL: Record<AdminNotification["kind"], string> = {
  validation: "Validations",
  dispute: "Litiges",
  moderation: "Modération",
  incident: "Incidents",
  return: "Retours",
};

const LINK: Record<string, (refId: string) => { to: string; params?: Record<string, string> }> = {
  validation: (refId) => ({
    to: "/admin/validations/$validationId",
    params: { validationId: refId },
  }),
  dispute: (refId) => ({ to: "/admin/disputes/$disputeId", params: { disputeId: refId } }),
  moderation: () => ({ to: "/admin/moderation" }),
  incident: () => ({ to: "/admin/incidents" }),
  return: (refId) => ({ to: "/admin/returns/$returnId", params: { returnId: refId } }),
};

const PRIORITY_DOT: Record<AdminNotificationPriority, string> = {
  info: "bg-blue-500",
  attention: "bg-amber-500",
  important: "bg-orange-500",
  urgent: "bg-destructive",
};

const PRIORITY_LABEL: Record<AdminNotificationPriority, string> = {
  info: "Information",
  attention: "À surveiller",
  important: "Important",
  urgent: "Urgent",
};

const GROUP_THRESHOLD = 4;
const GROUP_VISIBLE = 3;

function AdminNotifications() {
  const notifications = useAdminNotifications();
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "unread" | "urgent">("all");
  const [kindFilter, setKindFilter] = useState<"all" | AdminNotification["kind"]>("all");
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());

  const totalUrgent = notifications.filter((n) => n.priority === "urgent").length;
  const toHandle = notifications.filter(
    (n) => n.priority === "urgent" || n.priority === "important",
  ).length;

  const filtered = notifications.filter((n) => {
    if (urgencyFilter === "unread" && n.read) return false;
    if (urgencyFilter === "urgent" && n.priority !== "urgent") return false;
    if (kindFilter !== "all" && n.kind !== kindFilter) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const byKind = new Map<AdminNotification["kind"], (AdminNotification & { read: boolean })[]>();
    filtered.forEach((n) => {
      const list = byKind.get(n.kind) ?? [];
      list.push(n);
      byKind.set(n.kind, list);
    });
    return [...byKind.entries()].sort(
      (a, b) => new Date(b[1][0]?.at ?? 0).getTime() - new Date(a[1][0]?.at ?? 0).getTime(),
    );
  }, [filtered]);

  const toggleExpand = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Validations, litiges, incidents et signalements nécessitant votre attention"
        actions={
          unreadIds.length > 0 ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => adminNotifActions.markAllRead(unreadIds)}
            >
              <Check className="h-4 w-4" />
              Tout marquer comme lu
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={String(notifications.length)} icon={Bell} />
        <StatCard label="Non lues" value={String(unreadIds.length)} icon={Bell} />
        <StatCard
          label="Urgentes"
          value={String(totalUrgent)}
          icon={TriangleAlert}
          hint={totalUrgent > 0 ? "Action requise" : undefined}
        />
        <StatCard label="À traiter" value={String(toHandle)} icon={TriangleAlert} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
          {(
            [
              { v: "all", label: "Toutes" },
              { v: "unread", label: "Non lues" },
              { v: "urgent", label: "Urgentes" },
            ] as const
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setUrgencyFilter(t.v)}
              className={`h-8 rounded-xl px-3 text-xs font-medium transition ${urgencyFilter === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
          <button
            onClick={() => setKindFilter("all")}
            className={`h-8 rounded-xl px-3 text-xs font-medium transition ${kindFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            Toutes catégories
          </button>
          {(Object.keys(KIND_LABEL) as AdminNotification["kind"][]).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`h-8 rounded-xl px-3 text-xs font-medium transition ${kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Rien à signaler"
          description="Aucune notification ne correspond à ces filtres."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([kind, items]) => {
            const Icon = ICON[kind];
            const expanded = expandedKinds.has(kind) || items.length <= GROUP_THRESHOLD;
            const visible = expanded ? items : items.slice(0, GROUP_VISIBLE);
            const hiddenCount = items.length - visible.length;
            return (
              <div key={kind} className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{KIND_LABEL[kind]}</span>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <div className="divide-y divide-border">
                  {visible.map((n) => {
                    const target = LINK[n.kind](n.refId);
                    return (
                      <Link
                        key={n.id}
                        to={target.to}
                        params={target.params}
                        onClick={() => adminNotifActions.markRead(n.id)}
                        className={`flex items-start gap-3 p-4 hover:bg-accent/30 transition ${!n.read ? "bg-accent/10" : ""}`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[n.priority]}`}
                          title={PRIORITY_LABEL[n.priority]}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{n.title}</span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {relativeTime(n.at)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                {hiddenCount > 0 && (
                  <button
                    onClick={() => toggleExpand(kind)}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30"
                  >
                    Voir les {hiddenCount} autres
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
