import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, FileText, KeyRound, ShieldCheck } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";
import { usePublicInfo } from "@/components/landing/use-public-info";

export const Route = createFileRoute("/for-restaurants")({
  head: () => ({
    meta: [
      { title: "Pour les restaurants — Approvisionnement direct | Diambar Agro" },
      {
        name: "description",
        content:
          "Commandez vos produits frais directement aux producteurs sénégalais : livraison à l'heure choisie, remise par code, contrôle à la réception et facture PDF.",
      },
      { property: "og:title", content: "Pour les restaurants — Diambar Agro" },
      {
        property: "og:description",
        content:
          "Approvisionnez votre cuisine en direct producteur, livré à l'heure que vous choisissez.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200",
      },
    ],
  }),
  component: RestaurantsPage,
});

function RestaurantsPage() {
  const info = usePublicInfo();
  return (
    <RoleLanding
      eyebrow="Restaurants, hôtels & cantines"
      title="Un approvisionnement enfin prévisible"
      subtitle="Commandez directement aux producteurs, choisissez le jour et l'heure de livraison, et suivez chaque étape de la commande."
      image="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200"
      cta="Créer mon compte"
      role="restaurant"
      stats={[
        { value: "J+1", label: `livraison si commande avant ${info.cutoffHour}\u00a0h` },
        { value: `${info.receptionWindowHours}\u00a0h`, label: "pour refuser un produit abîmé" },
        { value: "0\u00a0F", label: "d'abonnement" },
      ]}
      benefits={[
        {
          icon: CalendarClock,
          title: "L'heure que vous voulez",
          desc: "Vous choisissez le jour et l'heure exacte de livraison, jusqu'à deux semaines à l'avance.",
        },
        {
          icon: KeyRound,
          title: "Remise prouvée",
          desc: "Le livreur ne remet rien sans votre code, et prend une photo à la livraison.",
        },
        {
          icon: ShieldCheck,
          title: "Contrôle à la réception",
          desc: `${info.receptionWindowHours}\u00a0h pour refuser ce qui ne va pas : la partie refusée vous est remboursée.`,
        },
        {
          icon: FileText,
          title: "Factures en PDF",
          desc: "Une facture numérotée par commande, égale au montant payé, dans votre espace.",
        },
      ]}
      steps={[
        "Créez votre compte restaurant : l'équipe vérifie votre établissement",
        "Parcourez le marché et comparez les prix des producteurs",
        "Validez votre panier, choisissez le jour et l'heure, puis payez",
        "Donnez votre code au livreur, contrôlez la réception, téléchargez la facture",
      ]}
    />
  );
}
