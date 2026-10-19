import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, CalendarClock, AlertTriangle, XCircle, Inbox } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { relativeTime } from "@/lib/format";
import { usePlatformUsers, useValidations } from "@/data/admin-store";
import type { ValidationStatus } from "@/data/admin-mocks";
import { listApplicationsFn, type Application } from "@/lib/auth/applications";
import { formatSenegalPhone } from "@/lib/auth/helpers";

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
  loader: () => listApplicationsFn(),
  component: AdminValidations,
});

const TABS: { v: ValidationStatus | "all"; label: string }[] = [
  { v: "all", label: "Toutes" },
  { v: "pending", label: "En attente" },
  { v: "needs_correction", label: "À revoir" },
  { v: "approved", label: "Approuvées" },
  { v: "rejected", label: "Refusées" },
];

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function AdminValidations() {
  const { applications, demoMode } = Route.useLoaderData();
  const validations = useValidations();
  const users = usePlatformUsers();
  const [tab, setTab] = useState<ValidationStatus | "all">("pending");

  // Dossiers de démonstration : seulement en mode démo, jamais mêlés aux vrais
  // comptes d'une plateforme en service.
  const demo = demoMode ? validations : [];
  const count = (s: ValidationStatus) =>
    applications.filter((a) => a.status === s).length + demo.filter((v) => v.status === s).length;
  // Les dossiers de démo sont tous datés du même jour de référence : "aujourd'hui"
  // est ancré sur le jour du dépôt le plus récent, pas sur l'horloge système.
  const latestDemo = demo.reduce<(typeof demo)[number] | undefined>(
    (a, b) => (a && a.submittedAt > b.submittedAt ? a : b),
    undefined,
  );
  const submittedToday =
    applications.filter((a) => isToday(a.submittedAt)).length +
    (latestDemo
      ? demo.filter((v) => v.submittedAt.slice(0, 10) === latestDemo.submittedAt.slice(0, 10))
          .length
      : 0);

  const realRows = applications.filter((a) => (tab === "all" ? true : a.status === tab));
  const demoRows = demo.filter((v) => (tab === "all" ? true : v.status === tab));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validations"
        subtitle="Vérifiez chaque inscription avant d'ouvrir l'accès à la plateforme"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="En attente" value={String(count("pending"))} icon={Clock} />
        <StatCard
          label="Déposées aujourd'hui"
          value={String(submittedToday)}
          icon={CalendarClock}
        />
        <StatCard label="À revoir" value={String(count("needs_correction"))} icon={AlertTriangle} />
        <StatCard label="Refusées" value={String(count("rejected"))} icon={XCircle} />
      </div>

      <div className="glass rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            aria-pressed={tab === t.v}
            className={`px-4 h-9 rounded-xl text-sm font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
            <span className="ml-2 text-[11px] opacity-80">
              {t.v === "all" ? applications.length + demo.length : count(t.v)}
            </span>
          </button>
        ))}
      </div>

      <section aria-labelledby="real-applications" className="space-y-3">
        <h2 id="real-applications" className="font-display text-lg font-semibold">
          Inscriptions reçues
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {realRows.map((a) => (
            <ApplicationCard key={a.id} application={a} />
          ))}
          {realRows.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground md:col-span-2">
              <Inbox className="mx-auto h-6 w-6 mb-2 opacity-60" aria-hidden />
              {applications.length === 0
                ? "Aucune inscription reçue pour l'instant."
                : "Aucune inscription dans cet onglet."}
            </div>
          )}
        </div>
      </section>

      {demoMode && demoRows.length > 0 && (
        <section aria-labelledby="demo-applications" className="space-y-3">
          <h2 id="demo-applications" className="font-display text-lg font-semibold">
            Dossiers de démonstration
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              données fictives, visibles en mode démo uniquement
            </span>
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {demoRows.map((v) => {
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
                    <img
                      src={u?.avatar || undefined}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
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
            {demoRows.length === 0 && (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground md:col-span-2">
                Aucune demande dans cet onglet.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

const ROLE_SUMMARY: Record<Application["account"]["role"], (a: Application) => string> = {
  farmer: (a) => a.submitted.details.farmName ?? "Exploitation",
  restaurant: (a) => a.submitted.details.restaurantName ?? "Établissement",
  driver: (a) =>
    `${a.submitted.details.vehicleType ?? "Moto"} · ${
      a.submitted.details.zones?.length ?? 0
    } zone(s)`,
};

function ApplicationCard({ application: a }: { application: Application }) {
  const name = `${a.account.firstName} ${a.account.lastName}`;
  return (
    <Link
      to="/admin/inscriptions/$applicationId"
      params={{ applicationId: a.id }}
      className="glass rounded-2xl p-5 hover:bg-accent/40 transition block"
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary font-semibold"
          aria-hidden
        >
          {a.account.firstName.charAt(0)}
          {a.account.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{name}</div>
          <div className="text-[11px] text-muted-foreground">
            {a.submitted.city ?? "Ville non précisée"} · Déposé {relativeTime(a.submittedAt)}
          </div>
        </div>
        <RoleBadge role={a.account.role} />
      </div>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Activité</dt>
          <dd className="truncate font-medium">{ROLE_SUMMARY[a.account.role](a)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Téléphone</dt>
          <dd className="font-medium">
            {a.account.phone ? `+221 ${formatSenegalPhone(a.account.phone)}` : "—"}
          </dd>
        </div>
      </dl>
      {a.status === "needs_correction" && a.note && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {a.note}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <AdminBadge value={a.status} />
        <span className="text-xs font-medium text-primary">Examiner le dossier →</span>
      </div>
    </Link>
  );
}
