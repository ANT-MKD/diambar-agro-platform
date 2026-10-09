import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import {
  AudiencesSection,
  GuaranteesSection,
  HomeFaq,
  HomeFinalCta,
  HomeHero,
  HowSection,
  HumanSection,
  ResultSection,
} from "@/components/landing/home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diambar Agro — Produits frais livrés le lendemain aux restaurants" },
      {
        name: "description",
        content:
          "Commandez avant 18 h directement aux producteurs sénégalais. Livraison le lendemain, remise par code et 48 h pour vérifier. Pilote à Dakar, accès sur demande.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="public-surface min-h-screen">
      <Navbar />
      <main>
        <HomeHero />
        <ResultSection />
        <HowSection />
        <GuaranteesSection />
        <HumanSection />
        <AudiencesSection />
        <HomeFaq />
        <HomeFinalCta />
      </main>
      <Footer />
    </div>
  );
}
