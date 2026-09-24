import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/legal-page";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — Diambar Agro" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation de la plateforme Diambar Agro : comptes, commandes, paiements, commissions et responsabilités.",
      },
      { property: "og:title", content: "Conditions générales d'utilisation — Diambar Agro" },
      {
        property: "og:description",
        content: "Le cadre contractuel de l'utilisation de la plateforme Diambar Agro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Légal"
      title="Conditions générales d'utilisation"
      updated="1er mai 2025"
      sections={[
        {
          heading: "Objet",
          paragraphs: [
            "Les présentes conditions régissent l'accès et l'utilisation de la plateforme Diambar Agro, qui met en relation producteurs agricoles, établissements de restauration et livreurs indépendants au Sénégal.",
            "Toute création de compte vaut acceptation pleine et entière des présentes conditions.",
          ],
        },
        {
          heading: "Comptes et vérification",
          paragraphs: [
            "Chaque utilisateur s'engage à fournir des informations exactes lors de son inscription. Les comptes producteurs et livreurs font l'objet d'une vérification documentaire préalable.",
            "Diambar Agro peut suspendre un compte en cas de fausse déclaration, de fraude ou de manquement répété aux règles de la plateforme.",
          ],
        },
        {
          heading: "Commandes et livraison",
          paragraphs: [
            "Une commande validée engage le producteur à préparer la marchandise dans le délai annoncé et le restaurant à en régler le montant.",
            "Les délais de livraison sont estimatifs et dépendent des conditions de circulation et de la zone desservie.",
          ],
        },
        {
          heading: "Prix, commissions et paiements",
          paragraphs: [
            "La commission prélevée est dégressive selon le volume mensuel et n'est appliquée que sur les commandes livrées et confirmées.",
            "Le producteur est payé sur la marchandise livrée ; les promotions et avoirs accordés par la plateforme ne sont jamais déduits de ses revenus. Ses demandes de retrait sont traitées sous 24 heures ouvrées vers Wave, Orange Money ou Free Money.",
            "Les frais de livraison dépendent de la zone de livraison (une livraison par producteur) et sont affichés avant la validation de la commande. Une commande peut être passée jusqu'à 18 h pour une livraison le lendemain.",
            "Le livreur perçoit 80 % du prix de la course, crédité dès la livraison confirmée par le code de remise du restaurant et une photo ; l'attente au-delà de 10 minutes est rémunérée.",
            "Le restaurant peut annuler sa commande tant que le producteur n'a pas commencé la préparation ; un paiement mobile déjà effectué est alors remboursé intégralement.",
          ],
        },
        {
          heading: "Litiges",
          paragraphs: [
            "À la réception, le restaurant peut refuser tout ou partie d'un produit dans les 48 heures suivant la livraison : le montant refusé lui est remboursé automatiquement.",
            "Tout autre litige relatif à une commande doit être signalé dans les 48 heures suivant la livraison via le centre de litiges ; l'équipe support instruit le dossier et informe les deux parties de sa décision.",
          ],
        },
        {
          heading: "Responsabilité",
          paragraphs: [
            "Diambar Agro agit en qualité d'intermédiaire technique et ne peut être tenue responsable de la qualité intrinsèque des produits vendus par les producteurs.",
            "La responsabilité de la plateforme est limitée au montant des commissions perçues sur la transaction concernée.",
          ],
        },
        {
          heading: "Droit applicable",
          paragraphs: [
            "Les présentes conditions sont soumises au droit sénégalais. À défaut d'accord amiable, tout différend relève des juridictions compétentes de Dakar.",
          ],
        },
      ]}
    />
  ),
});
