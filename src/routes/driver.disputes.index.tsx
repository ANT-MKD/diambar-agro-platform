import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
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
  const [supportOpen, setSupportOpen] = useState(false);
  return (
    <div className="space-y-6">
      <DisputeListView
        disputes={disputes}
        role="driver"
        detailPath="/driver/disputes/$disputeId"
        title="Litiges & réclamations"
        subtitle="Déclarez un désaccord, ajoutez vos preuves et suivez sa résolution."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSupportOpen(true)}>
              <LifeBuoy className="h-4 w-4" />
              Contacter le support
            </Button>
            <Button asChild className="gap-2">
              <Link to="/driver/disputes/new">
                <Plus className="h-4 w-4" />
                Nouveau litige
              </Link>
            </Button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Besoin d'aide ?</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Un incident peut parfois devenir un litige. N'hésitez pas à nous contacter.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSupportOpen(true)}>
          <LifeBuoy className="h-3.5 w-3.5" />
          Contacter le support
        </Button>
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Contacter le support</DialogTitle>
            <DialogDescription>
              Votre message crée un ticket réel suivi par l'équipe support Diambar.
            </DialogDescription>
          </DialogHeader>
          <SupportTicketForm
            role="driver"
            fromName="Oumar Ba"
            onCreated={() => setSupportOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
