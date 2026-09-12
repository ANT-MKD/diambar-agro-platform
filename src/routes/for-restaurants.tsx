import { createFileRoute } from "@tanstack/react-router";
import { Repeat, FileText, MapPin, Star } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";

export const Route = createFileRoute("/for-restaurants")({
  head: () => ({
    meta: [
      { title: "Pour les restaurants — Approvisionnement direct | Diambar Agro" },
      {
        name: "description",
        content:
          "Commandez vos produits frais directement aux producteurs sénégalais : récurrentes, factures, suivi GPS et scoring fournisseurs.",
      },
      { property: "og:title", content: "Pour les restaurants — Diambar Agro" },
      {
        property: "og:description",
        content:
          "Approvisionnez votre cuisine en direct producteur, avec suivi GPS et facturation.",
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
  component: () => (
    <RoleLanding
      eyebrow="Restaurants, hôtels & cantines"
      title="Un approvisionnement enfin prévisible"
      subtitle="Comparez les producteurs, programmez vos livraisons récurrentes et suivez chaque commande en temps réel."
      image="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200"
      cta="Essayer 30 jours"
      stats={[
        { value: "−22 %", label: "de coût matière" },
        { value: "94 %", label: "de ponctualité" },
        { value: "7j/7", label: "support prioritaire" },
      ]}
      benefits={[
        {
          icon: Repeat,
          title: "Commandes récurrentes",
          desc: "Programmez vos essentiels chaque semaine, sautez une échéance en un clic.",
        },
        {
          icon: FileText,
          title: "Factures conformes",
          desc: "PDF téléchargeables, TVA, filtres par période fiscale et export comptable.",
        },
        {
          icon: MapPin,
          title: "Suivi GPS",
          desc: "Position du livreur, ETA et lien de suivi public partageable avec votre équipe.",
        },
        {
          icon: Star,
          title: "Scoring fournisseurs",
          desc: "Qualité, ponctualité et fiabilité calculées sur votre historique réel.",
        },
      ]}
      steps={[
        "Créez votre compte restaurant et renseignez vos adresses de livraison",
        "Parcourez le marketplace et comparez les producteurs",
        "Validez votre panier et choisissez un créneau de livraison",
        "Suivez la livraison en direct et téléchargez votre facture",
      ]}
    />
  ),
});
