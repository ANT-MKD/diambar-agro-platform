import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, LifeBuoy, ChevronRight } from "lucide-react";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { helpCategories } from "@/data/site-content";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Centre d'aide — Diambar Agro" },
      {
        name: "description",
        content:
          "Guides pour démarrer, gérer vos commandes, vos paiements et résoudre un litige sur Diambar Agro.",
      },
      { property: "og:title", content: "Centre d'aide — Diambar Agro" },
      {
        property: "og:description",
        content: "Guides et articles d'assistance pour producteurs, restaurants et livreurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [q, setQ] = useState("");
  const cats = helpCategories
    .map((c) => ({ ...c, items: c.items.filter((i) => i.toLowerCase().includes(q.toLowerCase())) }))
    .filter((c) => c.items.length > 0);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Assistance"
        title="Centre d'aide"
        subtitle="Trouvez une réponse en quelques secondes."
      />
      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="glass rounded-2xl flex items-center gap-3 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un article…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {cats.map((c) => (
              <div key={c.title} className="glass rounded-2xl p-6">
                <h2 className="font-semibold">{c.title}</h2>
                <ul className="mt-4 space-y-2">
                  {c.items.map((i) => (
                    <li key={i}>
                      <Link
                        to="/contact"
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
                      >
                        {i}
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {cats.length === 0 && (
            <div className="glass mt-8 rounded-2xl p-12 text-center">
              <LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun article ne correspond à « {q} ».
              </p>
              <Link
                to="/contact"
                className="mt-5 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Poser la question au support
              </Link>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
