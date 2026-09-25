import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Flag, ClipboardList, TriangleAlert, Trash2, Clock } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { useModerationQueue } from "@/data/admin-store";

export const Route = createFileRoute("/admin/moderation/")({
  head: () => ({
    meta: [
      { title: "Modération — Administration Diambar Agro" },
      {
        name: "description",
        content: "Centre de modération des produits signalés sur la marketplace.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminModeration,
});

const TABS = [
  { key: "pending", label: "À traiter" },
  { key: "approved", label: "Conservés" },
  { key: "removed", label: "Dépubliés" },
  { key: "all", label: "Tous" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function AdminModeration() {
  const queue = useModerationQueue();
  const [tab, setTab] = useState<Tab>("pending");

  // Les dates de démo sont figées : "ce mois-ci" s'ancre sur l'événement le
  // plus récent réellement enregistré plutôt que sur l'horloge système.
  const refNow = useMemo(() => {
    const all = queue.flatMap((m) => m.events.map((e) => e.at));
    return all.length ? all.reduce((a, b) => (a > b ? a : b)) : new Date().toISOString();
  }, [queue]);
  const refMonth = refNow.slice(0, 7);

  const pending = queue.filter((m) => m.status === "pending");
  const urgent = pending.filter((m) => m.reports.length >= 2);
  const totalReports = queue.reduce((s, m) => s + m.reports.length, 0);
  const removedThisMonth = queue.filter(
    (m) =>
      m.status === "removed" &&
      m.events.some((e) => e.label === "Produit dépublié" && e.at.slice(0, 7) === refMonth),
  ).length;

  const rows = queue.filter((m) => (tab === "all" ? true : m.status === tab));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modération"
        subtitle="Vérifiez les produits et signalements de la plateforme"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Signalements" value={String(totalReports)} icon={Flag} />
        <StatCard label="À traiter" value={String(pending.length)} icon={ClipboardList} />
        <StatCard label="Urgents" value={String(urgent.length)} icon={TriangleAlert} />
        <StatCard label="Dépubliés ce mois" value={String(removedThisMonth)} icon={Trash2} />
      </div>

      <div className="glass rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 h-9 rounded-xl text-sm font-medium transition ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
            <span className="ml-2 text-[11px] opacity-80">
              {t.key === "all" ? queue.length : queue.filter((m) => m.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((m) => {
          const latest = m.reports[m.reports.length - 1];
          const isUrgent = m.status === "pending" && m.reports.length >= 2;
          return (
            <Link
              key={m.id}
              to="/admin/moderation/$itemId"
              params={{ itemId: m.id }}
              className="glass rounded-2xl overflow-hidden hover:bg-accent/30 transition block"
            >
              <div className="relative">
                <img
                  src={m.image}
                  alt={m.name}
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                {isUrgent && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 text-[10px] font-bold">
                    <TriangleAlert className="h-3 w-3" />
                    Urgent
                  </span>
                )}
              </div>
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
                  {latest?.reason ?? "Aucun signalement"}
                  {m.reports.length > 1 && ` · ${m.reports.length} signalements`}
                </p>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {latest ? `Signalé ${relativeTime(latest.at)}` : "Aucun signalement récent"}
                </div>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            Aucun produit dans cette catégorie.
          </div>
        )}
      </div>
    </div>
  );
}
