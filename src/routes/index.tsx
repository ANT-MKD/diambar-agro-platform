import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { LogosBar } from "@/components/landing/logos-bar";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Ecosystem } from "@/components/landing/ecosystem";
import { LiveTracking } from "@/components/landing/live-tracking";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diambar Agro — Du Champ à Votre Cuisine" },
      { name: "description", content: "Plateforme N°1 d'approvisionnement agricole au Sénégal. Connectez agriculteurs, restaurants et livreurs." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <LogosBar />
        <HowItWorks />
        <Features />
        <Ecosystem />
        <LiveTracking />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
