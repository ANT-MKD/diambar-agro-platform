const logos = ["Le Baobab", "Hôtel Téranga", "Marché Central Thiès", "Coopérative Sénégal", "Wave", "Orange Money", "Free Money", "Restaurant Ndiambour"];

export function LogosBar() {
  return (
    <section className="border-y border-border/50 bg-card/30 py-10 overflow-hidden">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Ils nous font confiance</p>
      <div className="relative">
        <div className="flex w-max animate-marquee gap-16 px-8">
          {[...logos, ...logos].map((l, i) => (
            <div key={i} className="text-lg font-display font-semibold text-muted-foreground/60 whitespace-nowrap">
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
