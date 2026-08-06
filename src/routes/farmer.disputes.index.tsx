import { createFileRoute } from "@tanstack/react-router";
import { DisputeListView } from "@/components/disputes/dispute-list-view";
import { useDisputesForRole } from "@/data/disputes";

export const Route = createFileRoute("/farmer/disputes/")({
  head: () => ({ meta: [
    { title: "Mes litiges — Espace producteur Diambar Agro" },
    { name: "description", content: "Suivi des litiges ouverts et reçus : statut, montant en jeu, délai de réponse." },
    { property: "og:title", content: "Mes litiges — Espace producteur" },
    { property: "og:description", content: "Suivi des litiges ouverts et reçus par le producteur." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => {
    const disputes = useDisputesForRole("farmer");
    return <DisputeListView disputes={disputes} role="farmer" detailPath="/farmer/disputes/$disputeId" />;
  },
});
