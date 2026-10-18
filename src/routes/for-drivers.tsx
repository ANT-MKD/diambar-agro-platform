import { createFileRoute } from "@tanstack/react-router";
import { Clock, Banknote, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";
import { usePublicInfo } from "@/components/landing/use-public-info";

export const Route = createFileRoute("/for-drivers")({
  head: () => ({
    meta: [
      { title: "Devenir livreur partenaire | Diambar Agro" },
      {
        name: "description",
        content:
          "Choisissez vos missions de livraison alimentaire au Sénégal, gardez la plus grande part de chaque course, gain crédité à chaque livraison.",
      },
      { property: "og:title", content: "Devenir livreur partenaire — Diambar Agro" },
      {
        property: "og:description",
        content: "Missions à la demande, gain crédité à chaque livraison, retrait sur demande.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200",
      },
    ],
  }),
  component: DriversPage,
});

function DriversPage() {
  const { driverShare } = usePublicInfo();
  return (
    <RoleLanding
      eyebrow="Livreurs indépendants"
      title="Roulez quand vous voulez, gagnez à chaque course"
      subtitle="Acceptez les missions qui vous arrangent : le gain est affiché avant d'accepter et crédité dès la livraison confirmée."
      image="https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1200"
      cta="Créer mon compte"
      role="driver"
      stats={[
        { value: `${driverShare}\u00a0%`, label: "de chaque course pour vous" },
        { value: "Wave", label: "ou Orange Money, retrait sur demande" },
        { value: "0\u00a0F", label: "frais d'inscription" },
      ]}
      benefits={[
        {
          icon: Clock,
          title: "Liberté totale",
          desc: "Passez en ligne quand vous voulez, refusez une mission sans pénalité.",
        },
        {
          icon: Banknote,
          title: "Revenus clairs",
          desc: "Gain affiché avant d'accepter, crédité à chaque livraison, historique consultable.",
        },
        {
          icon: RouteIcon,
          title: "Itinéraires optimisés",
          desc: "Plusieurs collectes regroupées en une tournée quand c'est possible.",
        },
        {
          icon: ShieldCheck,
          title: "Missions adaptées",
          desc: "Vous n'acceptez que des courses que votre véhicule peut transporter.",
        },
      ]}
      steps={[
        "Inscrivez-vous et transmettez permis, pièce d'identité et assurance",
        "Attendez la validation de votre dossier par l'équipe",
        "Activez le mode « En ligne » et acceptez vos premières missions",
        "Remettez la commande avec le code du restaurant et une photo : le gain est crédité",
      ]}
    />
  );
}
