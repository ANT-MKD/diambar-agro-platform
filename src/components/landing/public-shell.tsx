import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28">{children}</main>
      <Footer />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">{eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl lg:text-6xl font-bold">{title}</h1>
        {subtitle && <p className="mt-4 text-muted-foreground text-lg">{subtitle}</p>}
      </div>
    </section>
  );
}
