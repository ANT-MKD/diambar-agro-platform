import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare, Paperclip, HelpCircle, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { DisputeDetailView } from "@/components/disputes/dispute-detail-view";
import { useDisputeById, disputeActions } from "@/data/disputes";
import { restaurants } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/disputes/$disputeId")({
  head: () => ({
    meta: [
      { title: "Dossier de litige — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Suivi contradictoire d'un litige restaurant : preuves, réponses et décision.",
      },
      { property: "og:title", content: "Dossier de litige — Restaurant" },
      {
        property: "og:description",
        content: "Suivi contradictoire d'un litige : preuves, réponses et décision.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantDisputeDetail,
});

function RestaurantDisputeDetail() {
  const { disputeId } = Route.useParams();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const d = useDisputeById(disputeId);
  if (!d)
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/restaurant/disputes" className="mt-4 inline-block text-sm text-primary">
          Retour aux litiges
        </Link>
      </div>
    );
  const myName = myRestaurant?.name ?? user.name;
  const closed = d.status === "resolved" || d.status === "rejected";
  const otherPartyName = d.openedByRole === "restaurant" ? d.againstName : d.openedByName;

  return (
    <DisputeDetailView
      dispute={d}
      role="restaurant"
      name={myName}
      breadcrumb={
        <Link
          to="/restaurant/disputes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mes litiges
        </Link>
      }
      links={
        <>
          {d.orderId && (
            <Link
              to="/restaurant/orders/$orderId"
              params={{ orderId: d.orderId }}
              className="block text-primary hover:underline"
            >
              Commande {d.orderRef}
            </Link>
          )}
          {d.invoiceId && (
            <Link
              to="/restaurant/invoices/$invoiceId"
              params={{ invoiceId: d.invoiceId }}
              className="block text-primary hover:underline"
            >
              Facture liée
            </Link>
          )}
          {d.hasGpsTrack && (
            <span className="block text-muted-foreground">Trajet GPS versé au dossier</span>
          )}
        </>
      }
      quickActions={
        <div className="glass rounded-2xl p-5 space-y-2">
          <h2 className="font-semibold mb-1">Actions rapides</h2>
          <a
            href="#fil-contradictoire"
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent/40 transition"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Contacter {otherPartyName}
          </a>
          <a
            href="#fil-contradictoire"
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent/40 transition"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Ajouter une preuve
          </a>
          {!closed && (
            <button
              onClick={() => {
                disputeActions.reply(d.id, {
                  role: "restaurant",
                  name: myName,
                  text: "Pourriez-vous fournir des informations complémentaires sur ce dossier (photos, bon de livraison, précisions) ?",
                });
                toast.success("Demande de complément envoyée");
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-accent/40 transition"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Demander un complément
            </button>
          )}
          {!closed && (
            <button
              onClick={() => {
                disputeActions.escalate(d.id, `Escalade demandée par ${myName}`);
                toast.success("Litige escaladé · délai de réponse réduit à 12h");
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-destructive/30 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5 transition"
            >
              <TrendingUp className="h-4 w-4" />
              Escalader le litige
            </button>
          )}
          <Link
            to="/restaurant/returns"
            search={{ tab: "avoirs" }}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-accent/40 transition"
          >
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Voir mon portefeuille d'avoirs
          </Link>
        </div>
      }
    />
  );
}
