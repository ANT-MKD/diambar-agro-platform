import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/legal-page";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Diambar Agro" },
      {
        name: "description",
        content:
          "Comment Diambar Agro collecte, utilise et protège vos données personnelles, conformément à la loi sénégalaise sur la protection des données.",
      },
      { property: "og:title", content: "Politique de confidentialité — Diambar Agro" },
      {
        property: "og:description",
        content: "Traitement et protection de vos données personnelles sur Diambar Agro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LegalPage
      eyebrow="Légal"
      title="Politique de confidentialité"
      updated="1er mai 2025"
      sections={[
        {
          heading: "Données collectées",
          paragraphs: [
            "Nous collectons les données d'identification (nom, téléphone, email), les données professionnelles (exploitation, établissement, véhicule) et les données d'usage (commandes, messages, positions de livraison).",
          ],
        },
        {
          heading: "Finalités du traitement",
          paragraphs: [
            "Les données servent à exploiter le service : mise en relation, exécution des commandes, facturation, support et prévention de la fraude.",
            "Les données de géolocalisation des livreurs ne sont collectées que pendant une mission active.",
          ],
        },
        {
          heading: "Partage",
          paragraphs: [
            "Vos données ne sont jamais vendues. Elles sont partagées avec les seuls acteurs nécessaires à la commande (producteur, restaurant, livreur) et nos prestataires de paiement mobile money.",
          ],
        },
        {
          heading: "Conservation",
          paragraphs: [
            "Les données de compte sont conservées tant que le compte est actif, puis trois ans. Les pièces comptables sont conservées dix ans conformément aux obligations légales.",
          ],
        },
        {
          heading: "Vos droits",
          paragraphs: [
            "Vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition. Une demande peut être adressée à privacy@diambar-agro.sn et sera traitée sous 30 jours.",
          ],
        },
        {
          heading: "Cookies",
          paragraphs: [
            "Nous utilisons des cookies strictement nécessaires au fonctionnement (session, préférences d'affichage) et des cookies de mesure d'audience anonymisée.",
          ],
        },
        {
          heading: "Sécurité",
          paragraphs: [
            "Les accès sont chiffrés, les mots de passe hachés et les rôles cloisonnés. Tout incident de sécurité affectant vos données vous serait notifié sans délai.",
          ],
        },
      ]}
    />
  ),
});
