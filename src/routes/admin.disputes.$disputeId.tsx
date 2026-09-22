import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById } from "@/data/disputes";
import { useOrders, useMissions } from "@/data/store";
import { useIncidents } from "@/data/business";
import { useAdminRoleForEmail, can } from "@/data/admin-store";

export const Route = createFileRoute("/admin/disputes/$disputeId")({
  head: () => ({
    meta: [
      { title: "Dossier de litige — Administration Diambar Agro" },
      {
        name: "description",
        content: "Instruction, contradictoire, décision motivée et impact financier d'un litige.",
      },
      { property: "og:title", content: "Dossier de litige — Administration" },
      { property: "og:description", content: "Instruction et résolution d'un litige plateforme." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDisputeDetail,
});

function AdminDisputeDetail() {
  const { disputeId } = Route.useParams();
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canDecideDisputes = can(role, "disputes.decide");
  const d = useDisputeById(disputeId);
  const orders = useOrders();
  const missions = useMissions();
  const incidents = useIncidents();

  const order = d ? orders.find((o) => o.reference === d.orderRef) : undefined;
  const mission = d
    ? missions.find((m) => m.id === d.missionId || m.orderRef === d.orderRef)
    : undefined;
  const incident = mission
    ? incidents.find((i) => i.missionRef === mission.reference && i.status !== "resolved")
    : undefined;

  if (!d)
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/admin/disputes" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  return (
    <DisputeDetailView
      dispute={d}
      role="platform"
      name={user.name}
      canDecide={canDecideDisputes}
      breadcrumb={
        <Link
          to="/admin/disputes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Litiges
        </Link>
      }
      links={
        <>
          {order ? (
            <Link
              to="/admin/orders/$orderId"
              params={{ orderId: order.id }}
              className="flex items-center justify-between text-primary hover:underline"
            >
              Commande {d.orderRef}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link to="/admin/orders" className="block text-primary hover:underline">
              Commande {d.orderRef}
            </Link>
          )}
          {incident && (
            <Link
              to="/admin/incidents/$incidentId"
              params={{ incidentId: incident.id }}
              className="flex items-center justify-between text-amber-600 hover:underline dark:text-amber-400"
            >
              <span className="flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5" />
                Incident {incident.reference}
              </span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link to="/admin/finance" className="block text-primary hover:underline">
            Impact financier & avoirs
          </Link>
          <Link to="/admin/users" className="block text-primary hover:underline">
            Fiches des parties
          </Link>
          {d.hasGpsTrack && (
            <span className="block text-muted-foreground">Trajet GPS versé au dossier</span>
          )}
        </>
      }
    />
  );
}
