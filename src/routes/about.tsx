import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { milestones, impactStats } from "@/data/site-content";
import { usePublicInfo } from "@/components/landing/use-public-info";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "À propos — Diambar Agro" },
      {
        name: "description",
        content:
          "Notre mission : réduire les pertes post-récolte et connecter directement producteurs, restaurants et livreurs au Sénégal.",
      },
      { property: "og:title", content: "À propos — Diambar Agro" },
      {
        property: "og:description",
        content:
          "L'histoire et les engagements de la plateforme d'approvisionnement agricole du Sénégal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const info = usePublicInfo();
  return (
    <PublicShell>
      <PageHero
        eyebrow="Notre histoire"
        title="Rapprocher le champ de la cuisine"
        subtitle="Diambar Agro est née d'un constat simple : au Sénégal, une part énorme de la récolte se perd faute d'acheteur identifié."
      />

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {impactStats(info).map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6 text-center">
              <p className="font-display text-3xl font-bold text-gradient-emerald">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-card/30">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-display text-3xl font-bold text-center">Les étapes</h2>
          <div className="mt-10 space-y-4">
            {milestones.map((m) => (
              <div key={m.year} className="glass rounded-2xl p-6 flex gap-5">
                <span className="font-display text-2xl font-bold text-emerald-500 w-16 shrink-0">
                  {m.year}
                </span>
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-3xl font-bold">Parlons-en</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Producteur, restaurant, livreur ou partenaire : dites-nous ce dont vous avez besoin.
          </p>
          <div className="mt-8">
            <Link
              to="/contact"
              className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
