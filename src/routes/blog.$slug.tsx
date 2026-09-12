import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PublicShell } from "@/components/landing/public-shell";
import { blogPosts } from "@/data/site-content";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = blogPosts.find((p) => p.slug === params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Article introuvable — Diambar Agro" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { post } = loaderData;
    return {
      meta: [
        { title: `${post.title} — Diambar Agro` },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:image", content: post.cover },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: post.cover },
      ],
    };
  },
  notFoundComponent: PostNotFound,
  component: BlogPost,
});

function PostNotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">Article introuvable</h1>
        <p className="mt-3 text-muted-foreground">
          Cet article a peut-être été déplacé ou supprimé.
        </p>
        <Link
          to="/blog"
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Retour au blog
        </Link>
      </div>
    </PublicShell>
  );
}

function BlogPost() {
  const { post } = Route.useLoaderData();
  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> Tous les articles
        </Link>
        <span className="mt-6 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
          {post.category}
        </span>
        <h1 className="mt-3 font-display text-3xl lg:text-5xl font-bold leading-tight">
          {post.title}
        </h1>
        <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
          <img
            src={post.authorAvatar}
            alt=""
            loading="lazy"
            className="h-9 w-9 rounded-full object-cover"
          />
          <span>{post.author}</span>
          <span>·</span>
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span>·</span>
          <span>{post.readMinutes} min de lecture</span>
        </div>
        <img
          src={post.cover}
          alt={post.title}
          className="mt-8 w-full rounded-3xl object-cover aspect-[16/9]"
        />
        <div className="mt-8 space-y-5">
          {post.body.map((p: string, i: number) => (
            <p key={i} className="text-base leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </article>
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-2xl font-bold">À lire ensuite</h2>
          <div className="mt-6 grid md:grid-cols-3 gap-5">
            {related.map((p) => (
              <Link
                key={p.slug}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="glass rounded-3xl overflow-hidden hover:scale-[1.02] transition-all"
              >
                <img
                  src={p.cover}
                  alt={p.title}
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="font-semibold text-sm leading-snug">{p.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
