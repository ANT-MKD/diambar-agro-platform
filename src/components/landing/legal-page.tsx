import { PublicShell, PageHero } from "@/components/landing/public-shell";

export type LegalSection = { heading: string; paragraphs: string[] };

export function LegalPage({ eyebrow, title, updated, sections }: { eyebrow: string; title: string; updated: string; sections: LegalSection[] }) {
  return (
    <PublicShell>
      <PageHero eyebrow={eyebrow} title={title} subtitle={`Dernière mise à jour : ${updated}`} />
      <section className="pb-24">
        <div className="mx-auto max-w-3xl px-4 space-y-8">
          {sections.map((s, i) => (
            <div key={s.heading} className="glass rounded-2xl p-7">
              <h2 className="font-display text-xl font-bold">{i + 1}. {s.heading}</h2>
              <div className="mt-3 space-y-3">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}