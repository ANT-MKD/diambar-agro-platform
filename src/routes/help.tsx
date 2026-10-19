import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, LifeBuoy } from "lucide-react";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { usePublicInfo } from "@/components/landing/use-public-info";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { helpTopics } from "@/data/site-content";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Centre d'aide — Diambar Agro" },
      {
        name: "description",
        content:
          "Réponses pour démarrer, commander, payer, contrôler une livraison et retirer ses gains sur Diambar Agro.",
      },
      { property: "og:title", content: "Centre d'aide — Diambar Agro" },
      {
        property: "og:description",
        content: "Les réponses aux questions courantes des producteurs, restaurants et livreurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const info = usePublicInfo();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const cats = helpTopics(info)
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(needle)),
    }))
    .filter((c) => c.items.length > 0);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Assistance"
        title="Centre d'aide"
        subtitle="Les réponses aux questions les plus courantes, pour chaque espace."
      />
      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (paiement, livraison, retrait…)"
              aria-label="Rechercher dans l'aide"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mt-8 space-y-6" data-testid="help-topics">
            {cats.map((c) => (
              <div key={c.title} className="glass rounded-2xl p-6">
                <h2 className="font-semibold">{c.title}</h2>
                <Accordion type="multiple" className="mt-2">
                  {c.items.map((i) => (
                    <AccordionItem key={i.q} value={i.q} className="border-border">
                      <AccordionTrigger className="text-left text-sm hover:no-underline">
                        {i.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {i.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
          {cats.length === 0 && (
            <div className="glass mt-8 rounded-2xl p-12 text-center">
              <LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune réponse ne correspond à « {q} ».
              </p>
            </div>
          )}
          <div className="mt-8 text-center">
            <Link
              to="/contact"
              className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Poser la question à l'équipe
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
