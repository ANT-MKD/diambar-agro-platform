import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById } from "@/data/disputes";

export const Route = createFileRoute("/restaurant/disputes/$disputeId")({
  head: () => ({
    meta: [
      { title: "Dossier de litige — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Suivi contradictoire d'un litige restaurant : preuves, réponses et décision.",
      },
      { property: "og:title", content: "Dossier de litige — Restaurant" },
      {
        property: "og:description",
        content: "Suivi contradictoire d'un litige : preuves, réponses et décision.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantDisputeDetail,
});

function RestaurantDisputeDetail() {
  const { disputeId } = Route.useParams();
  const d = useDisputeById(disputeId);
  if (!d)
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/restaurant/disputes" className="mt-4 inline-block text-sm text-primary">
          Retour aux litiges
        </Link>
      </div>
    );
  return (
    <DisputeDetailView
      dispute={d}
      role="restaurant"
      name="Le Baobab"
      breadcrumb={
        <Link
          to="/restaurant/disputes"
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
              to="/restaurant/orders/$orderId"
              params={{ orderId: d.orderId }}
              className="block text-primary hover:underline"
            >
              Commande {d.orderRef}
            </Link>
          )}
          {d.invoiceId && (
            <Link
              to="/restaurant/invoices/$invoiceId"
              params={{ invoiceId: d.invoiceId }}
              className="block text-primary hover:underline"
            >
              Facture liée
            </Link>
          )}
          {d.hasGpsTrack && (
            <span className="block text-muted-foreground">Trajet GPS versé au dossier</span>
          )}
        </>
      }
    />
  );
}
