import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisputeListView } from "@/components/disputes/dispute-list-view";
import { useDisputesForRole } from "@/data/disputes";

export const Route = createFileRoute("/restaurant/disputes/")({
  head: () => ({
    meta: [
      { title: "Mes litiges — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Litiges ouverts sur vos commandes : statut, montant réclamé, avoirs et délais.",
      },
      { property: "og:title", content: "Mes litiges — Espace restaurant" },
      {
        property: "og:description",
        content: "Litiges ouverts sur vos commandes et avoirs obtenus.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantDisputesIndex,
});

function RestaurantDisputesIndex() {
  const disputes = useDisputesForRole("restaurant");
  return (
    <DisputeListView
      disputes={disputes}
      role="restaurant"
      detailPath="/restaurant/disputes/$disputeId"
      actions={
        <Button asChild className="gap-2">
          <Link to="/restaurant/disputes/new">
            <Plus className="h-4 w-4" />
            Ouvrir un litige
          </Link>
        </Button>
      }
    />
  );
}
