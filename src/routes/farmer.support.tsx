import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { PageHeader } from "@/components/farmer/page-header";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { SupportTicketList } from "@/components/support/support-ticket-list";
import { useSupportTicketsFor } from "@/data/support";

export const Route = createFileRoute("/farmer/support")({
  head: () => ({
    meta: [
      { title: "Support · Espace producteur Diambar Agro" },
      {
        name: "description",
        content: "Contactez le support Diambar Agro et suivez vos demandes précédentes.",
      },
    ],
  }),
  component: FarmerSupportPage,
});

function FarmerSupportPage() {
  const { user } = useRouteContext({ from: "/farmer" });
  const tickets = useSupportTicketsFor(user.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle="Une question, un litige de paiement, un problème technique ?"
      />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <SupportTicketForm role="farmer" fromName={user.name} />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Mes demandes</h3>
          <SupportTicketList tickets={tickets} />
        </div>
      </div>
    </div>
  );
}
