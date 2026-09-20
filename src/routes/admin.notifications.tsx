import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ShieldCheck, Scale, PackageSearch, TriangleAlert, Check } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { useAdminNotifications, adminNotifActions } from "@/data/admin-store";
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
} as const;

const LINK: Record<string, (refId: string) => { to: string; params?: Record<string, string> }> = {
  validation: (refId) => ({
    to: "/admin/validations/$validationId",
    params: { validationId: refId },
  }),
  dispute: (refId) => ({ to: "/admin/disputes/$disputeId", params: { disputeId: refId } }),
  moderation: () => ({ to: "/admin/moderation" }),
  incident: () => ({ to: "/admin/incidents" }),
};

function AdminNotifications() {
  const notifications = useAdminNotifications();
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

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

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Rien à signaler"
          description="Aucune validation, litige ou signalement en attente."
        />
      ) : (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          {notifications.map((n) => {
            const Icon = ICON[n.kind];
            const target = LINK[n.kind](n.refId);
            return (
              <Link
                key={n.id}
                to={target.to}
                params={target.params}
                onClick={() => adminNotifActions.markRead(n.id)}
                className={`flex items-start gap-3 p-4 hover:bg-accent/30 transition ${!n.read ? "bg-accent/10" : ""}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Icon className="h-4 w-4" />
                </div>
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
      )}
    </div>
  );
}
