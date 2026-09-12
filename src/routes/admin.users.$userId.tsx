import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, CheckCircle2, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, relativeTime } from "@/lib/format";
import { adminUserActions, auditActions, usePlatformUser } from "@/data/admin-store";
import { impersonationActions } from "@/data/impersonation";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({
    meta: [
      { title: "Fiche utilisateur — Administration Diambar Agro" },
      {
        name: "description",
        content: "Détail d'un compte : activité, volume, statut et actions de modération.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUserDetail,
});

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const user = usePlatformUser(userId);

  if (!user) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Compte introuvable</h2>
        <Link to="/admin/users" className="mt-4 inline-block text-sm text-primary">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Utilisateurs
      </Link>
      <PageHeader
        title={user.name}
        subtitle={`${user.email} · ${user.phone}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                impersonationActions.start(user.id, user.name, user.role);
                auditActions.log("Impersonation démarrée", user.name, "critical");
                toast.success(`Vous naviguez en tant que ${user.name}`);
              }}
            >
              <Eye className="h-4 w-4" />
              Voir en tant que
            </Button>
            {user.status !== "active" && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  adminUserActions.setStatus(user.id, "active");
                  auditActions.log("Compte réactivé", user.name);
                  toast.success("Compte activé");
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Activer
              </Button>
            )}
            {user.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  adminUserActions.setStatus(user.id, "suspended");
                  auditActions.log("Compte suspendu", user.name, "critical");
                  toast.success("Compte suspendu");
                }}
              >
                <Ban className="h-4 w-4" />
                Suspendre
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-destructive"
              onClick={() => {
                adminUserActions.setStatus(user.id, "rejected");
                auditActions.log("Compte rejeté", user.name, "critical");
                toast.success("Compte rejeté");
              }}
            >
              <Trash2 className="h-4 w-4" />
              Rejeter
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 flex items-center gap-4">
          <img src={user.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          <div className="space-y-1.5">
            <RoleBadge role={user.role} />
            <AdminBadge value={user.status} />
            <div className="text-xs text-muted-foreground">
              {user.city} · inscrit le {user.joinedAt}
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">Volume généré</div>
          <div className="font-display text-2xl font-bold mt-1">{formatFCFA(user.gmv)}</div>
          <div className="text-xs text-muted-foreground mt-2">{user.orders} commandes</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">Note moyenne</div>
          <div className="font-display text-2xl font-bold mt-1">{user.rating || "—"}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Dernière activité {relativeTime(user.lastActiveAt)}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Conformité</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span>Identité vérifiée</span>
            <AdminBadge
              value={user.verified ? "approved" : "pending"}
              label={user.verified ? "Vérifiée" : "À vérifier"}
            />
          </li>
          <li className="flex items-center justify-between">
            <span>Coordonnées bancaires / mobile money</span>
            <AdminBadge
              value={user.verified ? "approved" : "pending"}
              label={user.verified ? "Complètes" : "Manquantes"}
            />
          </li>
          <li className="flex items-center justify-between">
            <span>Contrat partenaire signé</span>
            <AdminBadge
              value={user.status === "active" ? "approved" : "pending"}
              label={user.status === "active" ? "Signé" : "En attente"}
            />
          </li>
        </ul>
      </div>
    </div>
  );
}
