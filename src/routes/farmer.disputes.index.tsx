import { createFileRoute, Link } from "@tanstack/react-router";
import { Headphones, FileWarning, Image, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisputeListView } from "@/components/disputes/dispute-list-view";
import { useDisputesForRole } from "@/data/disputes";

export const Route = createFileRoute("/farmer/disputes/")({
  head: () => ({
    meta: [
      { title: "Mes litiges — Espace producteur Diambar Agro" },
      {
        name: "description",
        content: "Suivi des litiges ouverts et reçus : statut, montant en jeu, délai de réponse.",
      },
      { property: "og:title", content: "Mes litiges — Espace producteur" },
      {
        property: "og:description",
        content: "Suivi des litiges ouverts et reçus par le producteur.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmerDisputesIndex,
});

const STEPS = [
  {
    icon: FileWarning,
    title: "Déclarer / recevoir le litige",
    text: "Un client signale un problème ou vous recevez une notification.",
  },
  {
    icon: Image,
    title: "Fournir les preuves",
    text: "Ajoutez des photos, documents ou explications sur la page du dossier.",
  },
  {
    icon: Gavel,
    title: "Recevoir la décision",
    text: "L'équipe Diambar Agro analyse le dossier et vous informe.",
  },
];

function FarmerDisputesIndex() {
  const disputes = useDisputesForRole("farmer");
  return (
    <div className="space-y-6">
      <DisputeListView disputes={disputes} role="farmer" detailPath="/farmer/disputes/$disputeId" />

      <div className="glass rounded-2xl p-5 grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <h3 className="font-semibold mb-3">Centre de résolution · comment ça marche ?</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold">{s.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2 md:border-l md:border-border md:pl-6">
          <div className="text-sm font-medium">Besoin d'aide ?</div>
          <p className="text-xs text-muted-foreground md:text-right max-w-56">
            Notre équipe est disponible pour vous accompagner.
          </p>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/farmer/support">
              <Headphones className="h-3.5 w-3.5" />
              Contacter l'assistance
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
