import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById } from "@/data/disputes";

export const Route = createFileRoute("/farmer/disputes/$disputeId")({
  head: () => ({
    meta: [
      { title: "Dossier de litige — Espace producteur Diambar Agro" },
      {
        name: "description",
        content: "Fil contradictoire, preuves et décision du support sur un litige producteur.",
      },
      { property: "og:title", content: "Dossier de litige — Producteur" },
      {
        property: "og:description",
        content: "Fil contradictoire, preuves et décision du support.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmerDisputeDetail,
});

function FarmerDisputeDetail() {
  const { disputeId } = Route.useParams();
  const d = useDisputeById(disputeId);
  if (!d)
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/farmer/disputes" className="mt-4 inline-block text-sm text-primary">
          Retour aux litiges
        </Link>
      </div>
    );
  return (
    <DisputeDetailView
      dispute={d}
      role="farmer"
      name="Coopérative Sow"
      breadcrumb={
        <Link
          to="/farmer/disputes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mes litiges
        </Link>
      }
      links={
        <>
          {d.orderId && (
            <Link
              to="/farmer/orders/$orderId"
              params={{ orderId: d.orderId }}
              className="block text-primary hover:underline"
            >
              Commande {d.orderRef}
            </Link>
          )}
          <Link to="/farmer/revenue" className="block text-primary hover:underline">
            Impact sur mes revenus
          </Link>
          {d.hasGpsTrack && (
            <span className="block text-muted-foreground">Trajet GPS disponible au dossier</span>
          )}
        </>
      }
    />
  );
}
