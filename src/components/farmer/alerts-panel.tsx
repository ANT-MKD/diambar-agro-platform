import { Link } from "@tanstack/react-router";
import { Bell, ArrowRight } from "lucide-react";
import { relativeTime } from "@/lib/format";
import { NOTIF_ICONS, NOTIF_TONES } from "@/components/common/notification-center";
import type { AppNotification } from "@/data/mocks";

export function AlertsPanel({
  items,
  viewAllTo,
  onOpen,
  limit = 5,
}: {
  items: AppNotification[];
  viewAllTo: string;
  onOpen?: (n: AppNotification) => void;
  limit?: number;
}) {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Alertes et notifications</h3>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={viewAllTo as any}
          className="text-xs text-primary font-medium inline-flex items-center gap-1"
        >
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Aucune notification</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((n) => {
            const Icon = NOTIF_ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => onOpen?.(n)}
                className="w-full flex items-start gap-3 text-left group"
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${NOTIF_TONES[n.type] ?? "bg-primary/10 text-primary"}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-sm font-semibold truncate group-hover:text-primary transition">
                      {n.title}
                    </div>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{n.body}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                  {relativeTime(n.at)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
