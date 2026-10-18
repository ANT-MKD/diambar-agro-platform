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
  VideoSection,
} from "@/components/landing/home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diambar Agro — Produits frais livrés le lendemain aux restaurants" },
      {
        name: "description",
        content:
          "Commandez la veille directement aux producteurs sénégalais. Livraison le lendemain à l'heure choisie, remise par code et remboursement de ce qui est refusé. Pilote à Dakar, inscription gratuite.",
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
        <VideoSection />
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
