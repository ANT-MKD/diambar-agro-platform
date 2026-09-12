import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById } from "@/data/disputes";

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
  const d = useDisputeById(disputeId);
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
      name="Support Diambar"
      canDecide
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
          <Link to="/admin/orders" className="block text-primary hover:underline">
            Commande {d.orderRef}
          </Link>
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
