import { createFileRoute } from "@tanstack/react-router";
import { Check, Flag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, relativeTime } from "@/lib/format";
import { moderationActions, useModerationQueue } from "@/data/admin-store";

export const Route = createFileRoute("/admin/moderation")({
  head: () => ({
    meta: [
      { title: "Modération des annonces — Administration Diambar Agro" },
      {
        name: "description",
        content: "File de modération des produits signalés sur la marketplace.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminModeration,
});

function AdminModeration() {
  const queue = useModerationQueue();
  const pending = queue.filter((m) => m.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader title="Modération" subtitle={`${pending.length} annonce(s) à traiter`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {queue.map((m) => (
          <div key={m.id} className="glass rounded-2xl overflow-hidden">
            <img src={m.image} alt={m.name} loading="lazy" className="h-36 w-full object-cover" />
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {m.farmer} · {formatFCFA(m.price)}/kg
                  </div>
                </div>
                <AdminBadge value={m.status} />
              </div>
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Flag className="h-4 w-4 shrink-0 text-amber-500" />
                {m.reason}
              </p>
              <div className="text-[11px] text-muted-foreground">
                Signalé {relativeTime(m.reportedAt)}
              </div>
              {m.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      moderationActions.approve(m.id);
                      toast.success("Annonce conservée");
                    }}
                  >
                    <Check className="h-4 w-4" />
                    Valider
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-destructive"
                    onClick={() => {
                      moderationActions.remove(m.id);
                      toast.success("Annonce retirée");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Retirer
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
