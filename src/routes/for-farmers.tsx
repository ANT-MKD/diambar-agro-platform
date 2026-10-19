import { createFileRoute } from "@tanstack/react-router";
import { Wallet, BarChart3, Boxes, ShieldCheck } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";

export const Route = createFileRoute("/for-farmers")({
  head: () => ({
    meta: [
      { title: "Pour les agriculteurs — Vendez en direct | Diambar Agro" },
      {
        name: "description",
        content:
          "Vendez votre récolte directement aux restaurants du Sénégal, sans intermédiaire, et retirez vos gains vers Wave ou Orange Money.",
      },
      { property: "og:title", content: "Pour les agriculteurs — Diambar Agro" },
      {
        property: "og:description",
        content: "Vendez votre récolte en direct aux restaurants, à votre prix.",
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
      },
    ],
  }),
  component: () => (
    <RoleLanding
      eyebrow="Agriculteurs & coopératives"
      title="Vendez votre récolte au juste prix"
      subtitle="Publiez vos stocks, recevez des commandes de restaurants vérifiés et retirez vos gains vers Wave ou Orange Money. Sans abonnement."
      image="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200"
      cta="Créer mon compte"
      role="farmer"
      stats={[
        { value: "Votre", label: "prix, fixé par vous" },
        { value: "Mobile", label: "money : Wave, Orange Money" },
        { value: "0\u00a0F", label: "frais d'inscription" },
      ]}
      benefits={[
        {
          icon: Wallet,
          title: "Gains clairs",
          desc: "Votre gain (prix moins la commission) est crédité à la livraison ; vous le retirez sur Wave ou Orange Money.",
        },
        {
          icon: Boxes,
          title: "Stock maîtrisé",
          desc: "Stock réservé à chaque commande, mouvements tracés, alerte quand un produit passe sous votre seuil.",
        },
        {
          icon: BarChart3,
          title: "Vos ventes en clair",
          desc: "Produits les plus vendus, évolution des commandes et relevé mensuel de vos gains.",
        },
        {
          icon: ShieldCheck,
          title: "Acheteurs vérifiés",
          desc: "Chaque restaurant est validé par notre équipe avant de commander.",
        },
      ]}
      steps={[
        "Créez votre compte producteur : l'équipe vérifie votre exploitation",
        "Ajoutez vos produits avec photos, prix, unité et quantité disponible",
        "Acceptez, ajustez ou refusez les commandes depuis votre tableau",
        "Remettez la marchandise au livreur avec votre code de collecte",
      ]}
    />
  ),
});
