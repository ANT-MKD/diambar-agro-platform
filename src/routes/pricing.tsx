import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { pricingPlans, pricingFaq } from "@/data/site-content";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tarifs — Diambar Agro" },
      { name: "description", content: "Commission dégressive pour les producteurs, abonnement Restaurant Pro à 15 000 FCFA/mois, gratuit pour les livreurs partenaires." },
      { property: "og:title", content: "Tarifs — Diambar Agro" },
      { property: "og:description", content: "Des tarifs transparents pour producteurs, restaurants et livreurs au Sénégal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <PublicShell>
      <PageHero eyebrow="Tarifs" title="Des prix clairs, sans surprise" subtitle="Vous ne payez que lorsque vous vendez ou livrez. Aucun frais d'inscription." />
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 grid md:grid-cols-3 gap-5">
          {pricingPlans.map((p) => (
            <div key={p.id} className={`glass rounded-3xl p-7 flex flex-col ${p.highlighted ? "border-emerald-500/40 ring-1 ring-emerald-500/30" : ""}`}>
              {p.highlighted && <span className="self-start rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">Le plus choisi</span>}
              <h2 className="mt-3 font-display text-2xl font-bold">{p.name}</h2>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{p.audience}</p>
              <div className="mt-5 flex items-end gap-2">
                <span className="font-display text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground pb-1">{p.period}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className={`mt-6 rounded-xl px-5 py-3 text-center text-sm font-semibold transition ${p.highlighted ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border hover:bg-accent"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <section className="pb-24 bg-card/30 pt-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-display text-3xl font-bold">Questions sur la tarification</h2>
          <Accordion type="single" collapsible className="mt-8 space-y-3">
            {pricingFaq.map((item, i) => (
              <AccordionItem key={i} value={`p-${i}`} className="glass rounded-2xl px-5 border-0">
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PublicShell>
  );
}