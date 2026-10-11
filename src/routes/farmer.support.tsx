import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import { MessageSquare, Clock, CheckCheck, Archive } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { SupportTicketList } from "@/components/support/support-ticket-list";
import { useSupportTicketsFor, TICKET_CATEGORY_LABEL, type TicketCategory } from "@/data/support";

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

  const open = tickets.filter((t) => t.status === "open").length;
  const answered = tickets.filter((t) => t.status === "answered").length;
  const closed = tickets.filter((t) => t.status === "closed").length;

  const categoryCounts = useMemo(() => {
    const totals = new Map<TicketCategory, number>();
    for (const t of tickets) totals.set(t.category, (totals.get(t.category) ?? 0) + 1);
    return Array.from(totals.entries())
      .map(([category, n]) => ({ category, n }))
      .sort((a, b) => b.n - a.n);
  }, [tickets]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle="Une question, un litige de paiement, un problème technique ?"
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MessageSquare}
          label="Total des demandes"
          value={String(tickets.length)}
          tone="blue"
        />
        <KpiCard icon={Clock} label="En cours" value={String(open)} tone="amber" />
        <KpiCard icon={CheckCheck} label="Répondues" value={String(answered)} tone="emerald" />
        <KpiCard icon={Archive} label="Fermées" value={String(closed)} tone="violet" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <SupportTicketForm role="farmer" fromName={user.name} />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Mes demandes</h3>
            <SupportTicketList tickets={tickets} />
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-4">Catégories</h3>
          {categoryCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune demande</p>
          ) : (
            <ul className="space-y-2.5">
              {categoryCounts.map((c) => (
                <li
                  key={c.category}
                  className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 -mx-2"
                >
                  <span className="flex-1 truncate">{TICKET_CATEGORY_LABEL[c.category]}</span>
                  <span className="font-semibold">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
