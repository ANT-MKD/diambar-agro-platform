import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell, PageHero } from "@/components/landing/public-shell";
import { blogPosts } from "@/data/site-content";

const categories = ["Tous", "Agriculture", "Restauration", "Logistique", "Produit"] as const;

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Agriculture, restauration et logistique | Diambar Agro" },
      { name: "description", content: "Analyses terrain sur les pertes post-récolte, le coût matière en restauration et la logistique du dernier kilomètre au Sénégal." },
      { property: "og:title", content: "Blog — Diambar Agro" },
      { property: "og:description", content: "Analyses terrain sur l'agriculture, la restauration et la logistique au Sénégal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const [cat, setCat] = useState<string>("Tous");
  const posts = cat === "Tous" ? blogPosts : blogPosts.filter((p) => p.category === cat);
  return (
    <PublicShell>
      <PageHero eyebrow="Blog" title="Le terrain, en clair" subtitle="Ce que nous apprenons des producteurs, des cuisines et des routes du Sénégal." />
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-xl px-4 py-2 text-sm font-medium transition ${cat === c ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((p) => (
              <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="glass rounded-3xl overflow-hidden hover:scale-[1.02] hover:border-emerald-500/30 transition-all">
                <img src={p.cover} alt={p.title} loading="lazy" className="h-44 w-full object-cover" />
                <div className="p-6">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">{p.category}</span>
                  <h2 className="mt-3 font-display text-lg font-bold leading-snug">{p.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <img src={p.authorAvatar} alt="" loading="lazy" className="h-6 w-6 rounded-full object-cover" />
                    {p.author} · {p.readMinutes} min
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}