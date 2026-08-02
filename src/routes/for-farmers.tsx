import { createFileRoute } from "@tanstack/react-router";
import { Wallet, BarChart3, Boxes, ShieldCheck } from "lucide-react";
import { RoleLanding } from "@/components/landing/role-landing";

export const Route = createFileRoute("/for-farmers")({
  head: () => ({
    meta: [
      { title: "Pour les agriculteurs — Vendez en direct | Diambar Agro" },
      { name: "description", content: "Vendez votre récolte directement aux restaurants du Sénégal, sans intermédiaire, payé sous 24h par Wave, Orange Money ou Free Money." },
      { property: "og:title", content: "Pour les agriculteurs — Diambar Agro" },
      { property: "og:description", content: "Vendez votre récolte en direct aux restaurants, payé sous 24h." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200" },
    ],
  }),
  component: () => (
    <RoleLanding
      eyebrow="Agriculteurs & coopératives"
      title="Vendez votre récolte au juste prix"
      subtitle="Publiez vos stocks, recevez des commandes de restaurants vérifiés et soyez payé sous 24h. Sans abonnement."
      image="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200"
      cta="Créer ma ferme"
      stats={[
        { value: "+38 %", label: "de marge moyenne" },
        { value: "24h", label: "délai de paiement" },
        { value: "0 F", label: "frais d'inscription" },
      ]}
      benefits={[
        { icon: Wallet, title: "Paiement rapide", desc: "Retrait sur Wave, Orange Money ou Free Money sous 24h après livraison." },
        { icon: Boxes, title: "Stock maîtrisé", desc: "Alertes de rupture, mouvements d'entrée/sortie et inventaire complet." },
        { icon: BarChart3, title: "Analytics de ventes", desc: "Comprenez vos meilleurs produits, vos pics de demande et vos prévisions." },
        { icon: ShieldCheck, title: "Acheteurs vérifiés", desc: "Chaque restaurant est validé par notre équipe avant de commander." },
      ]}
      steps={[
        "Créez votre compte producteur et vérifiez votre identité",
        "Ajoutez vos produits avec photos, prix et quantités disponibles",
        "Acceptez les commandes entrantes depuis votre tableau Kanban",
        "Remettez la marchandise au livreur et suivez le paiement",
      ]}
    />
  ),
});