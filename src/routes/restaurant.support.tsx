import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { PageHeader } from "@/components/farmer/page-header";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { SupportTicketList } from "@/components/support/support-ticket-list";
import { useSupportTicketsFor } from "@/data/support";

export const Route = createFileRoute("/restaurant/support")({
  head: () => ({
    meta: [
      { title: "Support · Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Contactez le support Diambar Agro et suivez vos demandes précédentes.",
      },
    ],
  }),
  component: RestaurantSupportPage,
});

function RestaurantSupportPage() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const tickets = useSupportTicketsFor(user.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle="Une commande en retard, un litige facturation, une question ?"
      />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <SupportTicketForm role="restaurant" fromName={user.name} />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Mes demandes</h3>
          <SupportTicketList tickets={tickets} />
        </div>
      </div>
    </div>
  );
}
