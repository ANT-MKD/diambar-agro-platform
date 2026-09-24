// Contenu éditorial du site public (pages marketing, blog, légal)

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

export const pricingPlans: PricingPlan[] = [
  {
    id: "farmer",
    name: "Producteur",
    audience: "Agriculteurs & coopératives",
    price: "Gratuit",
    period: "commission 5 – 15 %",
    description: "Vendez directement aux restaurants, sans intermédiaire ni abonnement.",
    features: [
      "Boutique et catalogue illimités",
      "Gestion du stock et alertes",
      "Retrait vers Wave, OM ou Free (traité sous 24 h ouvrées)",
      "Analytics de ventes",
      "Support WhatsApp 6j/7",
    ],
    cta: "Créer ma ferme",
  },
  {
    id: "resto",
    name: "Restaurant",
    audience: "Restaurants, hôtels, cantines",
    price: "Gratuit",
    period: "frais de livraison selon la zone",
    description: "L'approvisionnement piloté : récurrentes, factures et suivi de livraison.",
    features: [
      "Commandes récurrentes automatiques",
      "Factures égales au montant payé, export CSV",
      "Code de remise et photo à chaque livraison",
      "48 h pour refuser un produit, remboursement automatique",
      "Multi-utilisateurs (équipe)",
    ],
    highlighted: true,
    cta: "Créer mon compte",
  },
  {
    id: "driver",
    name: "Livreur partenaire",
    audience: "Livreurs indépendants",
    price: "Gratuit",
    period: "80 % de la course",
    description:
      "Choisissez vos missions, roulez quand vous voulez, payé dès la livraison confirmée.",
    features: [
      "Missions selon votre véhicule",
      "Gain crédité à chaque livraison",
      "Attente payée au-delà de 10 minutes",
      "Retrait vers Wave, OM ou Free",
      "Tournées optimisées",
    ],
    cta: "Devenir livreur",
  },
];

export const pricingFaq = [
  {
    q: "Y a-t-il des frais cachés ?",
    a: "Non. La commission est prélevée uniquement sur les commandes livrées et confirmées. Aucun frais d'inscription, aucun engagement.",
  },
  {
    q: "Comment est calculée la commission ?",
    a: "Elle est dégressive selon votre volume mensuel : 15 % en dessous de 250 000 FCFA, jusqu'à 5 % au-delà de 1 500 000 FCFA.",
  },
  {
    q: "Et si un produit arrive abîmé ou manquant ?",
    a: "Vous avez 48 h après la livraison pour refuser tout ou partie d'une ligne depuis la commande : le montant vous est remboursé automatiquement.",
  },
  {
    q: "Les frais de livraison sont-ils inclus ?",
    a: "Non, ils sont facturés séparément selon la zone (de 1 000 à 8 500 FCFA de base) et affichés avant validation du panier.",
  },
];

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

export const blogPosts: BlogPost[] = [
  {
    slug: "reduire-pertes-post-recolte-senegal",
    title: "Réduire les pertes post-récolte au Sénégal : 5 leviers concrets",
    excerpt:
      "Près de 30 % de la production maraîchère sénégalaise est perdue avant d'atteindre l'assiette. Voici ce qui change quand la vente est planifiée.",
    category: "Agriculture",
    author: "Mamadou Diallo",
    authorAvatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120",
    date: "2025-05-12",
    readMinutes: 6,
    cover: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1200",
    body: [
      "Dans la zone des Niayes, la tomate se récolte souvent plus vite qu'elle ne se vend. Sans acheteur identifié à l'avance, le producteur brade ou jette.",
      "Le premier levier est la commande anticipée : quand un restaurant réserve 50 kg pour jeudi, la récolte est calibrée sur la demande réelle plutôt que sur l'espoir d'un marché.",
      "Le deuxième levier est la chaîne du froid partagée. Mutualiser un espace réfrigéré entre trois exploitations coûte moins cher qu'une perte de 20 % chaque semaine.",
      "Troisième levier : la traçabilité. Un lot identifié, daté et photographié se négocie mieux et se conteste moins.",
      "Quatrième levier : la logistique groupée. Une camionnette qui charge chez trois producteurs voisins divise le coût au kilo.",
      "Cinquième levier : la donnée. Savoir que vos oignons partent surtout le lundi et le jeudi change votre calendrier de semis.",
    ],
  },
  {
    slug: "restaurant-maitriser-cout-matiere",
    title: "Restaurants : maîtriser son coût matière sans sacrifier la qualité",
    excerpt:
      "Acheter en direct producteur fait baisser le coût matière de 15 à 25 %. Encore faut-il structurer ses achats.",
    category: "Restauration",
    author: "Aminata Ndiaye",
    authorAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
    date: "2025-05-06",
    readMinutes: 5,
    cover: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200",
    body: [
      "Le coût matière représente en moyenne 32 % du chiffre d'affaires d'un restaurant à Dakar. Chaque point gagné est du résultat net.",
      "Première étape : figer un socle de produits récurrents. Riz, oignons, tomates, huile : ces lignes sont prévisibles et méritent un contrat hebdomadaire.",
      "Deuxième étape : comparer à volume égal. Un prix au kilo n'a de sens qu'avec un calibre et un taux de perte connus.",
      "Troisième étape : suivre les écarts. Une facture qui dérive de 8 % sur un mois signale un problème de portionnage ou de réception.",
      "Enfin, la relation directe avec le producteur permet d'anticiper les ruptures saisonnières plutôt que de les subir.",
    ],
  },
  {
    slug: "logistique-derniere-mile-dakar",
    title: "Dernier kilomètre à Dakar : ce que nos 12 000 livraisons nous ont appris",
    excerpt:
      "Créneaux, embouteillages, points de dépose : anatomie d'une livraison alimentaire réussie en zone urbaine dense.",
    category: "Logistique",
    author: "Oumar Ba",
    authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120",
    date: "2025-04-28",
    readMinutes: 7,
    cover: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200",
    body: [
      "Entre 7h et 9h, la corniche ajoute 25 minutes à un trajet Pikine – Plateau. Une livraison alimentaire se joue à ce niveau de détail.",
      "Nous avons observé que les créneaux de 6h à 8h offrent un taux de ponctualité de 94 %, contre 71 % en milieu de matinée.",
      "Le regroupement de missions par corridor (Thiès → Dakar) réduit le coût par commande de 30 % et augmente la rémunération horaire du livreur.",
      "La preuve de livraison photo a fait chuter les litiges de colis manquant de 62 %.",
      "La leçon principale : la logistique alimentaire n'est pas un problème de vitesse, c'est un problème de prévisibilité.",
    ],
  },
  {
    slug: "nouveautes-produit-mai-2025",
    title: "Nouveautés produit : commandes récurrentes, litiges et suivi public",
    excerpt:
      "Un tour d'horizon des fonctionnalités livrées ce mois-ci sur la plateforme Diambar Agro.",
    category: "Produit",
    author: "Équipe Diambar",
    authorAvatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    date: "2025-04-15",
    readMinutes: 4,
    cover: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200",
    body: [
      "Les commandes récurrentes permettent désormais de programmer une livraison hebdomadaire ou bimensuelle, avec possibilité de sauter une échéance.",
      "Le centre de litiges donne un cadre clair : ouverture, instruction par le support, résolution sous 48h ouvrées.",
      "Le suivi public partageable permet d'envoyer un lien de tracking à un collaborateur sans compte sur la plateforme.",
      "Prochaine étape : l'application mobile hors-ligne pour les livreurs en zone à faible couverture réseau.",
    ],
  },
];

export const teamMembers = [
  {
    name: "Seynabou Faye",
    role: "Cofondatrice & CEO",
    bio: "15 ans dans l'agro-industrie ouest-africaine.",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300",
  },
  {
    name: "Cheikh Diop",
    role: "Cofondateur & CTO",
    bio: "Ex-lead engineer fintech mobile money.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300",
  },
  {
    name: "Marième Thiam",
    role: "Directrice des opérations",
    bio: "Pilotage logistique et réseau producteurs.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300",
  },
  {
    name: "Alioune Sarr",
    role: "Responsable partenariats",
    bio: "Anciennement acheteur pour un groupe hôtelier.",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300",
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
export const impactStats = [
  { value: "J+1", label: "livraison dès le lendemain" },
  { value: "48 h", label: "pour signaler un problème à la réception" },
  { value: "24 h", label: "pour traiter un retrait producteur" },
  { value: "0 FCFA", label: "d'abonnement" },
];

export const helpCategories = [
  {
    title: "Démarrer",
    items: [
      "Créer un compte",
      "Vérifier son identité",
      "Configurer son profil",
      "Comprendre les rôles",
    ],
  },
  {
    title: "Commandes",
    items: [
      "Passer une commande",
      "Modifier ou annuler",
      "Commandes récurrentes",
      "Suivre une livraison",
    ],
  },
  {
    title: "Paiements",
    items: [
      "Moyens de paiement acceptés",
      "Délais de versement",
      "Retirer ses revenus",
      "Comprendre la commission",
    ],
  },
  {
    title: "Litiges",
    items: [
      "Signaler un produit non conforme",
      "Délais de traitement",
      "Demander un remboursement",
      "Contester une décision",
    ],
  },
];
