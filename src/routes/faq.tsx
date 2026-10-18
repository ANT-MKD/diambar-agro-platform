import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { generalFaq, pricingFaq } from "@/data/site-content";
import { usePublicInfo } from "@/components/landing/use-public-info";
import { DEFAULT_PUBLIC_INFO, type PublicInfo } from "@/lib/public-info-model";

const allFaq = (info: PublicInfo) => [...generalFaq(info), ...pricingFaq(info)];

/** Informations chargées par la route racine (pour les données SEO). */
const rootInfo = (matches: { routeId: string; loaderData?: unknown }[]) =>
  (matches.find((m) => m.routeId === "__root__")?.loaderData as PublicInfo | undefined) ??
  DEFAULT_PUBLIC_INFO;

export const Route = createFileRoute("/faq")({
  head: ({ matches }) => ({
    meta: [
      { title: "FAQ — Questions fréquentes | Diambar Agro" },
      {
        name: "description",
        content:
          "Commissions, délais de paiement, livraison, litiges : toutes les réponses sur le fonctionnement de Diambar Agro.",
      },
      { property: "og:title", content: "FAQ — Questions fréquentes | Diambar Agro" },
      {
        property: "og:description",
        content: "Toutes les réponses sur le fonctionnement de la plateforme Diambar Agro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: allFaq(rootInfo(matches)).map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  const all = allFaq(usePublicInfo());
  return (
    <PublicShell>
      <PageHero
        eyebrow="Support"
        title="Questions fréquentes"
        subtitle="Vous ne trouvez pas votre réponse ? Le centre d'aide et l'équipe support sont là."
      />
      <section className="pb-20">
        <div className="mx-auto max-w-3xl px-4">
          <Accordion type="single" collapsible className="space-y-3">
            {all.map((item, i) => (
              <AccordionItem key={i} value={`f-${i}`} className="glass rounded-2xl px-5 border-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/help"
              className="rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-accent transition"
            >
              Centre d'aide
            </Link>
            <Link
              to="/contact"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              Contacter le support
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
