import { createFileRoute } from "@tanstack/react-router";
import { DisputeListView } from "@/components/disputes/dispute-list-view";
import { useDisputesForRole } from "@/data/disputes";

export const Route = createFileRoute("/driver/disputes/")({
  head: () => ({
    meta: [
      { title: "Mes litiges — Espace livreur Diambar Agro" },
      {
        name: "description",
        content: "Incidents de course et litiges livreur : statut, indemnité demandée, délais.",
      },
      { property: "og:title", content: "Mes litiges — Espace livreur" },
      { property: "og:description", content: "Incidents de course et litiges livreur." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverDisputesIndex,
});

function DriverDisputesIndex() {
  const disputes = useDisputesForRole("driver");
  return (
    <DisputeListView
      disputes={disputes}
      role="driver"
      detailPath="/driver/disputes/$disputeId"
      title="Mes litiges & incidents"
    />
  );
}
