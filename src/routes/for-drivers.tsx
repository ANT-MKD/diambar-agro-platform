import { createFileRoute } from "@tanstack/react-router";
import { Clock, Banknote, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";

export const Route = createFileRoute("/for-drivers")({
  head: () => ({
    meta: [
      { title: "Devenir livreur partenaire | Diambar Agro" },
      { name: "description", content: "Choisissez vos missions de livraison alimentaire au Sénégal, gardez 80 % de la course et soyez payé le jour même." },
      { property: "og:title", content: "Devenir livreur partenaire — Diambar Agro" },
      { property: "og:description", content: "Missions à la demande, 80 % de la course, paiement journalier." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200" },
    ],
  }),
  component: () => (
    <RoleLanding
      eyebrow="Livreurs indépendants"
      title="Roulez quand vous voulez, payé le jour même"
      subtitle="Acceptez les missions qui vous arrangent, suivez votre itinéraire optimisé et encaissez chaque soir."
      image="https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200"
      cta="Devenir livreur"
      stats={[
        { value: "80 %", label: "de la course" },
        { value: "J+0", label: "paiement" },
        { value: "0 F", label: "commission fixe" },
      ]}
      benefits={[
        { icon: Clock, title: "Liberté totale", desc: "Passez en ligne quand vous voulez, refusez une mission sans pénalité." },
        { icon: Banknote, title: "Revenus clairs", desc: "Gains par mission, bonus de performance et historique consultable." },
        { icon: RouteIcon, title: "Itinéraires optimisés", desc: "Missions regroupées par corridor pour maximiser vos gains horaires." },
        { icon: ShieldCheck, title: "Assurance incluse", desc: "Chaque mission acceptée est couverte pendant toute la livraison." },
      ]}
      steps={[
        "Inscrivez-vous et transmettez permis, pièce d'identité et assurance",
        "Passez la validation de votre véhicule sous 48h",
        "Activez le mode « En ligne » et acceptez vos premières missions",
        "Déposez la preuve de livraison photo et encaissez le soir même",
      ]}
    />
  ),
});