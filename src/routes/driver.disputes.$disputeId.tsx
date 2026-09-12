import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById } from "@/data/disputes";

export const Route = createFileRoute("/driver/disputes/$disputeId")({
  head: () => ({
    meta: [
      { title: "Dossier de litige — Espace livreur Diambar Agro" },
      {
        name: "description",
        content:
          "Détail d'un incident de course : preuves, réponses et impact sur le portefeuille.",
      },
      { property: "og:title", content: "Dossier de litige — Livreur" },
      {
        property: "og:description",
        content: "Détail d'un incident de course et impact portefeuille.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverDisputeDetail,
});

function DriverDisputeDetail() {
  const { disputeId } = Route.useParams();
  const d = useDisputeById(disputeId);
  if (!d)
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/driver/disputes" className="mt-4 inline-block text-sm text-primary">
          Retour aux litiges
        </Link>
      </div>
    );
  return (
    <DisputeDetailView
      dispute={d}
      role="driver"
      name="Modou Sarr"
      breadcrumb={
        <Link
          to="/driver/disputes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mes litiges
        </Link>
      }
      links={
        <>
          {d.missionId && (
            <Link
              to="/driver/missions/$missionId"
              params={{ missionId: d.missionId }}
              className="block text-primary hover:underline"
            >
              Mission liée
            </Link>
          )}
          <Link to="/driver/wallet" className="block text-primary hover:underline">
            Portefeuille (retenues éventuelles)
          </Link>
          {d.hasGpsTrack && (
            <span className="block text-muted-foreground">Trajet GPS enregistré</span>
          )}
        </>
      }
    />
  );
}
