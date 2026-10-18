// Contenu éditorial du site public (pages marketing, blog, légal)

import {
  commissionExplanation,
  commissionRange,
  paymentMethodsText,
  type PublicInfo,
} from "@/lib/public-info-model";

export type PricingPlan = {
  id: string;
  name: string;
  audience: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

/** Offres de la page Tarifs, avec les taux réglés par l'admin. */
export function pricingPlans(info: PublicInfo): PricingPlan[] {
  return [
    {
      id: "farmer",
      name: "Producteur",
      audience: "Agriculteurs & coopératives",
      price: "Gratuit",
      period: `commission ${commissionRange(info.tiers)}`,
      description: "Vendez directement aux restaurants, sans intermédiaire ni abonnement.",
      features: [
        "Boutique et catalogue illimités",
        "Gestion du stock et alertes de seuil",
        "Gain crédité à la livraison, retrait vers Wave ou Orange Money",
        "Tableau des ventes et relevé mensuel",
      ],
      cta: "Créer mon compte",
    },
    {
      id: "resto",
      name: "Restaurant",
      audience: "Restaurants, hôtels, cantines",
      price: "Gratuit",
      period: "frais de livraison selon la distance",
      description:
        "L'approvisionnement direct : heure de livraison choisie, remise prouvée et facture.",
      features: [
        "Livraison à l'heure que vous choisissez",
        "Code de remise et photo à chaque livraison",
        "Facture PDF égale au montant payé",
        `${info.receptionWindowHours} h pour refuser un produit, remboursement automatique`,
      ],
      highlighted: true,
      cta: "Créer mon compte",
    },
    {
      id: "driver",
      name: "Livreur partenaire",
      audience: "Livreurs indépendants",
      price: "Gratuit",
      period: `${info.driverShare} % de la course`,
      description:
        "Choisissez vos missions, roulez quand vous voulez, gain crédité dès la livraison confirmée.",
      features: [
        "Missions selon votre véhicule",
        "Gain affiché avant d'accepter, crédité à chaque livraison",
        "Retrait vers Wave ou Orange Money",
        "Relevé mensuel de vos gains",
      ],
      cta: "Créer mon compte",
    },
  ];
}

/** Questions sur la tarification (page Tarifs et FAQ). */
export function pricingFaq(info: PublicInfo) {
  return [
    {
      q: "Y a-t-il des frais cachés ?",
      a: "Non. La commission est prélevée uniquement sur les commandes livrées et confirmées. Aucun frais d'inscription, aucun engagement.",
    },
    {
      q: "Comment est calculée la commission ?",
      a: commissionExplanation(info.tiers),
    },
    {
      q: "Et si un produit arrive abîmé ou manquant ?",
      a: `Vous avez ${info.receptionWindowHours} h après la livraison pour refuser tout ou partie d'une ligne depuis la commande : le montant vous est remboursé automatiquement.`,
    },
    {
      q: "Les frais de livraison sont-ils inclus ?",
      a: `Non, ils dépendent de la distance entre le producteur et votre restaurant et du poids commandé${info.deliveryFrom > 0 ? ` (à partir de ${fcfa(info.deliveryFrom)})` : ""}. Ils sont affichés avant la validation du panier.`,
    },
  ];
}

/** Questions générales de la page FAQ. */
export function generalFaq(info: PublicInfo) {
  return [
    {
      q: "Comment créer un compte ?",
      a: "Choisissez votre rôle (Agriculteur, Restaurant ou Livreur) sur la page d'inscription et remplissez le formulaire. Votre dossier est vérifié par l'équipe avant l'ouverture du compte, en général sous 48 heures ouvrées. L'inscription est gratuite.",
    },
    {
      q: "Jusqu'à quelle heure puis-je commander ?",
      a: `Avant ${info.cutoffHour} h pour être livré dès le lendemain. Vous choisissez le jour et l'heure de livraison au moment de commander.`,
    },
    {
      q: "Comment fonctionnent les paiements ?",
      a: `Les restaurants paient ${paymentMethodsText(info.payments)}. Un paiement mobile se fait au plus tard la veille de la livraison à ${info.paymentDeadlineHour} h, sinon la commande est annulée. Producteurs et livreurs retirent leurs gains vers Wave ou Orange Money, à partir de ${fcfa(info.minPayout)}.`,
    },
    {
      q: "Comment les agriculteurs sont-ils vérifiés ?",
      a: "Chaque dossier d'inscription est examiné par l'équipe (identité, exploitation) avant que le producteur puisse vendre.",
    },
    {
      q: "Puis-je suivre ma livraison ?",
      a: "Oui. Vous suivez chaque étape depuis votre espace restaurant : acceptée par le producteur, collectée, en route, livrée. Vous recevez une notification à chaque changement.",
    },
    {
      q: "Que se passe-t-il si les produits ne correspondent pas ?",
      a: `Vous pouvez refuser les produits à la livraison ou les signaler dans les ${info.receptionWindowHours} h depuis la commande. La partie concernée vous est remboursée.`,
    },
    {
      q: "Puis-je annuler une commande ?",
      a: "Oui, tant que le producteur n'a pas commencé la préparation. Un paiement déjà fait vous est alors remboursé. Ensuite, contactez le producteur ou le support.",
    },
    {
      q: "Comment devenir livreur partenaire ?",
      a: "Inscrivez-vous avec le rôle « Livreur » en indiquant votre véhicule, votre numéro de permis et vos zones. Les courses s'ouvrent une fois le dossier validé par l'équipe.",
    },
    {
      q: "Y a-t-il un abonnement ?",
      a: "Non. L'inscription est gratuite pour tous. Les producteurs paient une commission sur les ventes livrées, les restaurants les frais de livraison.",
    },
  ];
}

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: "Agriculture" | "Restauration" | "Logistique" | "Produit";
  author: string;
  authorAvatar: string;
  date: string;
  readMinutes: number;
  cover: string;
  body: string[];
};

// Articles sans chiffres invérifiables : la plateforme démarre, elle ne cite
// pas de statistiques qu'elle ne peut pas prouver.
export const blogPosts: BlogPost[] = [
  {
    slug: "reduire-pertes-post-recolte-senegal",
    title: "Réduire les pertes post-récolte au Sénégal : 5 leviers concrets",
    excerpt:
      "Une partie de la production maraîchère se perd avant d'atteindre l'assiette. Voici ce qui change quand la vente est planifiée.",
    category: "Agriculture",
    author: "Équipe Diambar",
    authorAvatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    date: "2026-10-18",
    readMinutes: 5,
    cover: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
    body: [
      "Dans la zone des Niayes, la tomate se récolte souvent plus vite qu'elle ne se vend. Sans acheteur identifié à l'avance, le producteur brade ou jette.",
      "Le premier levier est la commande anticipée : quand un restaurant réserve 50 kg pour jeudi, la récolte est calibrée sur la demande réelle plutôt que sur l'espoir d'un marché.",
      "Le deuxième levier est la chaîne du froid partagée : un espace réfrigéré commun à plusieurs exploitations coûte souvent moins cher que des pertes répétées.",
      "Troisième levier : la traçabilité. Un lot identifié, daté et photographié se négocie mieux et se conteste moins.",
      "Quatrième levier : la logistique groupée. Un véhicule qui charge chez plusieurs producteurs voisins réduit le coût au kilo.",
      "Cinquième levier : connaître sa demande. Savoir quels jours vos oignons partent le plus aide à organiser vos récoltes.",
    ],
  },
  {
    slug: "restaurant-maitriser-cout-matiere",
    title: "Restaurants : maîtriser son coût matière sans sacrifier la qualité",
    excerpt:
      "Acheter en direct au producteur peut alléger le coût matière. Encore faut-il structurer ses achats.",
    category: "Restauration",
    author: "Équipe Diambar",
    authorAvatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    date: "2026-10-18",
    readMinutes: 4,
    cover: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200",
    body: [
      "Le coût matière est l'un des premiers postes de dépense d'un restaurant : chaque point gagné se retrouve dans le résultat.",
      "Première étape : repérer votre socle de produits réguliers. Riz, oignons, tomates, huile : ces lignes sont prévisibles et se commandent à l'avance.",
      "Deuxième étape : comparer à quantité égale. Un prix au kilo n'a de sens qu'avec un calibre et une qualité connus.",
      "Troisième étape : suivre les écarts. Une facture qui dérive d'un mois sur l'autre signale un problème de portionnage ou de réception.",
      "Enfin, la relation directe avec le producteur permet d'anticiper les ruptures saisonnières plutôt que de les subir.",
    ],
  },
  {
    slug: "logistique-derniere-mile-dakar",
    title: "Dernier kilomètre à Dakar : ce qui fait une livraison réussie",
    excerpt:
      "Heure de livraison, embouteillages, remise : les détails qui font la différence pour une livraison alimentaire en ville.",
    category: "Logistique",
    author: "Équipe Diambar",
    authorAvatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    date: "2026-10-18",
    readMinutes: 4,
    cover: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200",
    body: [
      "Aux heures de pointe, certains axes de Dakar allongent nettement les trajets. Une livraison alimentaire se joue à ce niveau de détail.",
      "Choisir une heure de livraison réaliste, hors des pointes quand c'est possible, laisse au livreur le temps d'arriver à l'heure.",
      "Regrouper les collectes proches les unes des autres réduit le coût de chaque commande.",
      "Une remise prouvée (code du restaurant et photo) évite les contestations sur un colis manquant.",
      "La leçon principale : la logistique alimentaire n'est pas un problème de vitesse, c'est un problème de prévisibilité.",
    ],
  },
  {
    slug: "comment-se-passe-une-commande",
    title: "Comment se passe une commande sur Diambar Agro",
    excerpt:
      "Du panier à la facture : les étapes d'une commande, et ce que chacun voit à chaque moment.",
    category: "Produit",
    author: "Équipe Diambar",
    authorAvatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    date: "2026-10-18",
    readMinutes: 3,
    cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200",
    body: [
      "Le restaurant choisit ses produits sur le marché, puis le jour et l'heure de livraison. Les frais de livraison, calculés selon la distance et le poids, sont affichés avant de valider.",
      "Il paie par Wave, Orange Money ou en espèces à la livraison, selon les moyens ouverts. Un paiement mobile non fait à temps annule la commande et remet le stock en vente.",
      "Le producteur accepte la commande, ou ajuste les quantités s'il n'a pas tout : le restaurant ne paie que ce qui est fourni.",
      "Le livreur collecte la marchandise avec le code du producteur, puis la remet au restaurant contre son code, photo à l'appui.",
      "Après la livraison, le restaurant dispose d'un délai pour refuser ce qui ne va pas : la partie refusée lui est remboursée. La facture PDF suit dans son espace.",
    ],
  },
];

export const milestones = [
  {
    year: "2023",
    title: "L'idée",
    text: "Trois marchés visités par semaine pendant six mois pour comprendre la chaîne d'approvisionnement.",
  },
  {
    year: "2024",
    title: "Premier pilote",
    text: "Premiers échanges avec des producteurs de Thiès et des restaurants de Dakar.",
  },
  {
    year: "2025",
    title: "Passage à l'échelle",
    text: "Construction de la plateforme : commandes, livraisons avec preuve de remise, paiements mobiles.",
  },
  {
    year: "2026",
    title: "Objectif",
    text: "Couvrir les 14 régions du Sénégal et ouvrir la logistique inter-régionale.",
  },
];

// Engagements de la plateforme (pas encore de chiffres d'activité publiés).
export const impactStats = (info: PublicInfo) => [
  { value: "J+1", label: `livraison dès le lendemain (commande avant ${info.cutoffHour} h)` },
  { value: `${info.receptionWindowHours} h`, label: "pour signaler un problème à la réception" },
  { value: "24 h", label: "pour traiter un retrait producteur" },
  { value: "0 FCFA", label: "d'abonnement" },
];

/** Centre d'aide : réponses courtes, fidèles au fonctionnement de l'app et
 * aux réglages de la plateforme. */
export function helpTopics(
  info: PublicInfo,
): { title: string; items: { q: string; a: string }[] }[] {
  return [
    {
      title: "Démarrer",
      items: [
        {
          q: "Créer un compte",
          a: "Sur la page d'inscription, choisissez votre rôle (agriculteur, restaurant ou livreur) et remplissez le formulaire. L'inscription est gratuite.",
        },
        {
          q: "Pourquoi mon compte est-il vérifié ?",
          a: "L'équipe vérifie chaque exploitation, établissement et livreur avant d'ouvrir l'espace, en général sous 48 heures ouvrées. Vous recevez un email quand votre compte est ouvert, ou si une information manque.",
        },
        {
          q: "Les rôles",
          a: "Le producteur publie ses produits et prépare les commandes, le restaurant commande et paie, le livreur collecte et livre. L'équipe Diambar vérifie les comptes, les paiements et les versements.",
        },
      ],
    },
    {
      title: "Commander (restaurants)",
      items: [
        {
          q: "Passer une commande",
          a: "Ajoutez des produits au panier depuis le marché, choisissez le jour et l'heure de livraison, puis le moyen de paiement. Les frais de livraison, calculés selon la distance et le poids, sont affichés avant de valider.",
        },
        {
          q: "Heure limite et jour de livraison",
          a: `Avant ${info.cutoffHour} h, vous pouvez être livré dès le lendemain ; après, au plus tôt le surlendemain. Vous pouvez aussi choisir un jour jusqu'à deux semaines à l'avance.`,
        },
        {
          q: "Si le producteur n'a pas tout",
          a: "Au moment de commander, vous choisissez : recevoir ce qui est disponible ou annuler la commande. Vous ne payez que ce qui est fourni.",
        },
        {
          q: "Annuler une commande",
          a: "Depuis la commande, tant que le producteur n'a pas commencé la préparation. Un paiement déjà fait vous est remboursé. Ensuite, contactez le producteur ou le support.",
        },
        {
          q: "Suivre une livraison",
          a: "La commande affiche chaque étape : acceptée, collectée, en route, livrée. Votre code de remise y est indiqué : donnez-le au livreur à l'arrivée, il prend aussi une photo.",
        },
      ],
    },
    {
      title: "Paiements et factures",
      items: [
        {
          q: "Moyens de paiement",
          a: `Vous payez ${paymentMethodsText(info.payments)}. Pour Wave ou Orange Money, envoyez le montant au numéro indiqué puis saisissez la référence de la transaction : l'équipe la vérifie.`,
        },
        {
          q: "Délai de paiement",
          a: `Un paiement mobile se fait au plus tard la veille de la livraison à ${info.paymentDeadlineHour} h (et dans les 24 h qui suivent la commande). Un rappel est envoyé une heure avant ; sans paiement, la commande est annulée et le stock remis en vente.`,
        },
        {
          q: "Factures",
          a: "Une facture PDF numérotée est émise pour chaque commande une fois la livraison faite et le délai de contrôle passé. Elle est égale au montant payé.",
        },
        {
          q: "La commission (producteurs)",
          a: commissionExplanation(info.tiers),
        },
        {
          q: "Retirer ses gains (producteurs et livreurs)",
          a: `Vos gains sont crédités à chaque livraison. Demandez un retrait vers Wave ou Orange Money à partir de ${fcfa(info.minPayout)} : l'équipe vous le verse et vous recevez une notification. Un relevé mensuel est disponible dans votre espace.`,
        },
      ],
    },
    {
      title: "Réception et problèmes",
      items: [
        {
          q: "Refuser un produit abîmé ou manquant",
          a: `Dans les ${info.receptionWindowHours} h qui suivent la livraison, indiquez depuis la commande la quantité refusée et le motif. Le remboursement est créé aussitôt et versé par l'équipe.`,
        },
        {
          q: "Après le délai de contrôle",
          a: "Passez par la page Contact : l'équipe examine la situation avec vous et le producteur.",
        },
      ],
    },
    {
      title: "Livrer (livreurs)",
      items: [
        {
          q: "Accepter une course",
          a: "Les courses ouvertes affichent le trajet, le poids et votre gain. Vous ne pouvez accepter que ce que votre véhicule peut porter.",
        },
        {
          q: "Collecte et remise",
          a: "Chez le producteur, saisissez son code de collecte. Chez le restaurant, saisissez son code de remise et ajoutez une photo : la course est alors payée.",
        },
        ...(info.payments.cash
          ? [
              {
                q: "Commandes payées en espèces",
                a: "Le montant à encaisser est affiché sur la course. Vous remettez ensuite les espèces à l'équipe ; au-delà d'un plafond non remis, vous ne pouvez plus accepter de course payée en espèces.",
              },
            ]
          : []),
      ],
    },
  ];
}
