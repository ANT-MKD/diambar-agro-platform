import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { PublicShell } from "@/components/landing/public-shell";

export type RoleLandingProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  cta: string;
  benefits: { icon: LucideIcon; title: string; desc: string }[];
  steps: string[];
  stats: { value: string; label: string }[];
};

export function RoleLanding({
  eyebrow,
  title,
  subtitle,
  image,
  cta,
  benefits,
  steps,
  stats,
}: RoleLandingProps) {
  return (
    <PublicShell>
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-4xl lg:text-6xl font-bold leading-tight">
              {title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition"
              >
                {cta}
              </Link>
              <Link
                to="/pricing"
                className="rounded-xl border border-border px-6 py-3.5 text-sm font-semibold hover:bg-accent transition"
              >
                Voir les tarifs
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl font-bold text-gradient-emerald">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <img
            src={image}
            alt={title}
            className="rounded-[32px] object-cover aspect-[4/3] w-full"
          />
        </div>
      </section>

      <section className="py-20 bg-card/30">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center font-display text-3xl lg:text-4xl font-bold">
            Pourquoi Diambar Agro
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b) => (
              <div key={b.title} className="glass rounded-2xl p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <b.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-sm">{b.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center font-display text-3xl font-bold">Comment démarrer</h2>
          <ol className="mt-10 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="glass rounded-2xl p-5 flex items-center gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-500">
                  {i + 1}
                </span>
                <span className="text-sm">{s}</span>
                <Check className="ml-auto h-4 w-4 text-emerald-500" />
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link
              to="/register"
              className="inline-flex rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              {cta}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
