import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-surface min-h-screen">
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
        <p className="eyebrow text-emerald-700">{eyebrow}</p>
        <h1 className="display-xl mt-4 text-4xl lg:text-6xl">{title}</h1>
        {subtitle && <p className="mt-4 text-muted-foreground text-lg">{subtitle}</p>}
      </div>
    </section>
  );
}
