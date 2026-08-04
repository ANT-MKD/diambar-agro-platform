import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { relativeTime } from "@/lib/format";
import { usePlatformUsers, useValidations } from "@/data/admin-store";

export const Route = createFileRoute("/admin/validations/")({
  head: () => ({ meta: [{ title: "Validations de comptes — Administration Diambar Agro" }, { name: "description", content: "File de validation des agriculteurs et livreurs : documents, identité, décision." }, { name: "robots", content: "noindex" }] }),
  component: AdminValidations,
});

function AdminValidations() {
  const validations = useValidations();
  const users = usePlatformUsers();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const rows = validations.filter((v) => v.status === tab);

  return (
    <div className="space-y-6">
      <PageHeader title="Validations" subtitle="Contrôle des documents avant activation d'un compte" />
      <div className="glass rounded-2xl p-1.5 inline-flex gap-1">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 h-9 rounded-xl text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
            {t === "pending" ? "En attente" : t === "approved" ? "Approuvées" : "Rejetées"}
            <span className="ml-2 text-[11px] opacity-80">{validations.filter((v) => v.status === t).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((v) => {
          const u = users.find((x) => x.id === v.userId);
          return (
            <Link key={v.id} to="/admin/validations/$validationId" params={{ validationId: v.id }} className="glass rounded-2xl p-5 hover:bg-accent/40 transition block">
              <div className="flex items-center gap-3">
                <img src={u?.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u?.name}</div>
                  <div className="text-[11px] text-muted-foreground">Déposé {relativeTime(v.submittedAt)}</div>
                </div>
                <RoleBadge role={v.type} />
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {v.docs.map((d) => (
                  <li key={d.label} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{d.label}</span>
                    <AdminBadge value={d.ok ? "approved" : "pending"} label={d.ok ? "OK" : "À revoir"} />
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
        {rows.length === 0 && <div className="glass rounded-2xl p-10 text-center text-muted-foreground md:col-span-2">Aucune demande dans cet onglet.</div>}
      </div>
    </div>
  );
}
