import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, CalendarClock, AlertTriangle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { relativeTime } from "@/lib/format";
import { usePlatformUsers, useValidations } from "@/data/admin-store";
import type { ValidationStatus } from "@/data/admin-mocks";

export const Route = createFileRoute("/admin/validations/")({
  head: () => ({
    meta: [
      { title: "Validations de comptes — Administration Diambar Agro" },
      {
        name: "description",
        content: "File de validation des agriculteurs, restaurants et livreurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminValidations,
});

const TABS: { v: ValidationStatus | "all"; label: string }[] = [
  { v: "all", label: "Toutes" },
  { v: "pending", label: "En attente" },
  { v: "needs_correction", label: "À revoir" },
  { v: "approved", label: "Approuvées" },
  { v: "rejected", label: "Refusées" },
];

function AdminValidations() {
  const validations = useValidations();
  const users = usePlatformUsers();
  const [tab, setTab] = useState<ValidationStatus | "all">("pending");
  const rows = validations.filter((v) => (tab === "all" ? true : v.status === tab));

  const pending = validations.filter((v) => v.status === "pending");
  const needsCorrection = validations.filter((v) => v.status === "needs_correction");
  const rejected = validations.filter((v) => v.status === "rejected");
  // Les dossiers de démo sont tous datés du même jour de référence : "aujourd'hui"
  // est ancré sur le jour du dépôt le plus récent, pas sur l'horloge système.
  const latestSubmit = validations.reduce(
    (a, b) => (a && a.submittedAt > b.submittedAt ? a : b),
    validations[0],
  );
  const submittedToday = latestSubmit
    ? validations.filter(
        (v) => v.submittedAt.slice(0, 10) === latestSubmit.submittedAt.slice(0, 10),
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validations"
        subtitle="Contrôlez les documents et autorisez l'accès aux comptes professionnels"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="En attente" value={String(pending.length)} icon={Clock} />
        <StatCard
          label="Déposées aujourd'hui"
          value={String(submittedToday)}
          icon={CalendarClock}
        />
        <StatCard label="À revoir" value={String(needsCorrection.length)} icon={AlertTriangle} />
        <StatCard label="Refusées" value={String(rejected.length)} icon={XCircle} />
      </div>

      <div className="glass rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`px-4 h-9 rounded-xl text-sm font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
            <span className="ml-2 text-[11px] opacity-80">
              {t.v === "all"
                ? validations.length
                : validations.filter((v) => v.status === t.v).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((v) => {
          const u = users.find((x) => x.id === v.userId);
          const flaggedDoc = v.docs.find((d) => !d.ok);
          return (
            <Link
              key={v.id}
              to="/admin/validations/$validationId"
              params={{ validationId: v.id }}
              className="glass rounded-2xl p-5 hover:bg-accent/40 transition block"
            >
              <div className="flex items-center gap-3">
                <img src={u?.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u?.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {u?.city} · Déposé {relativeTime(v.submittedAt)}
                  </div>
                </div>
                <RoleBadge role={v.type} />
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {v.docs.map((d) => (
                  <li key={d.label} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{d.label}</span>
                    <AdminBadge
                      value={d.ok ? "approved" : "pending"}
                      label={d.ok ? "Vérifié" : "À vérifier"}
                    />
                  </li>
                ))}
              </ul>
              {v.status === "needs_correction" && flaggedDoc?.note && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {flaggedDoc.label} : {flaggedDoc.note}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <AdminBadge value={v.status} />
                <span className="text-xs font-medium text-primary">Examiner le dossier →</span>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground md:col-span-2">
            Aucune demande dans cet onglet.
          </div>
        )}
      </div>
    </div>
  );
}
