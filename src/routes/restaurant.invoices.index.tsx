import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/farmer/empty-state";

export const Route = createFileRoute("/restaurant/invoices/")({
  head: () => ({ meta: [{ title: "Factures · Restaurant" }] }),
  component: () => (
    <div className="grid place-items-center h-full min-h-[500px] p-8">
      <EmptyState
        icon={FileText}
        title="Aucune facture sélectionnée"
        description="Choisissez une facture dans la liste pour en voir le détail."
      />
    </div>
  ),
});
