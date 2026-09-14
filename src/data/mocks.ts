// Mock data centralisée pour DIAMBAR AGRO — sera remplacée par Supabase

export type Role = "farmer" | "restaurant" | "driver" | "admin";

export const cities = ["Dakar", "Thiès", "Mbour", "Saint-Louis", "Ziguinchor"] as const;

export const farmers = [
  {
    id: "f1",
    name: "Mamadou Diallo",
    city: "Thiès",
    farm: "Ferme Diallo",
    phone: "+221 77 123 45 67",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200",
    rating: 4.9,
    products: 8,
    verified: true,
  },
  {
    id: "f2",
    name: "Fatou Sow",
    city: "Dakar-Pikine",
    farm: "Coopérative Sow",
    phone: "+221 78 200 33 44",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200",
    rating: 4.8,
    products: 6,
    verified: true,
  },
  {
    id: "f3",
    name: "Ibrahima Ndoye",
    city: "Mbour",
    farm: "Niayes Ndoye",
    phone: "+221 76 555 11 22",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    rating: 4.7,
    products: 5,
    verified: true,
  },
];

export const restaurants = [
  {
    id: "r1",
    name: "Le Baobab",
    city: "Dakar Plateau",
    type: "Sénégalaise",
    phone: "+221 33 821 45 67",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200",
  },
  {
    id: "r2",
    name: "Chez Aminata",
    city: "Thiès",
    type: "Sénégalaise",
    phone: "+221 33 951 22 33",
    avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200",
  },
  {
    id: "r3",
    name: "Restaurant Téranga",
    city: "Dakar",
    type: "Hôtel",
    phone: "+221 33 889 10 11",
    avatar: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200",
  },
];

export const drivers = [
  {
    id: "d1",
    name: "Oumar Ba",
    vehicle: "Moto",
    rating: 4.9,
    missions: 234,
    phone: "+221 77 456 78 90",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
  },
  {
    id: "d2",
    name: "Cheikh Fall",
    vehicle: "Camionnette",
    rating: 4.7,
    missions: 156,
    phone: "+221 76 234 56 78",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
  },
];

export type Product = {
  id: string;
  name: string;
  category: "Légumes" | "Fruits" | "Viande" | "Volaille" | "Céréales" | "Tubercules" | "Épices";
  pricePerKg: number;
  unit: string;
  stock: number;
  minStock: number;
  sku: string;
  image: string;
  status: "active" | "low" | "out" | "draft";
  ordersThisMonth: number;
  farmerId: string;
};

export const products: Product[] = [
  {
    id: "p1",
    name: "Tomates fraîches",
    category: "Légumes",
    pricePerKg: 850,
    unit: "kg",
    stock: 47,
    minStock: 30,
    sku: "SKU-TOM-001",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
    status: "active",
    ordersThisMonth: 12,
    farmerId: "f1",
  },
  {
    id: "p2",
    name: "Oignons rouges",
    category: "Légumes",
    pricePerKg: 450,
    unit: "kg",
    stock: 18,
    minStock: 25,
    sku: "SKU-OIG-002",
    image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=600",
    status: "low",
    ordersThisMonth: 9,
    farmerId: "f1",
  },
  {
    id: "p3",
    name: "Poulet fermier",
    category: "Volaille",
    pricePerKg: 3200,
    unit: "kg",
    stock: 80,
    minStock: 20,
    sku: "SKU-POU-003",
    image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600",
    status: "active",
    ordersThisMonth: 22,
    farmerId: "f2",
  },
  {
    id: "p4",
    name: "Mangues Kent",
    category: "Fruits",
    pricePerKg: 600,
    unit: "kg",
    stock: 0,
    minStock: 40,
    sku: "SKU-MAN-004",
    image: "https://images.unsplash.com/photo-1605027990121-cbae9e0642db?w=600",
    status: "out",
    ordersThisMonth: 5,
    farmerId: "f3",
  },
  {
    id: "p5",
    name: "Manioc",
    category: "Tubercules",
    pricePerKg: 350,
    unit: "kg",
    stock: 120,
    minStock: 30,
    sku: "SKU-MAN-005",
    image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600",
    status: "active",
    ordersThisMonth: 7,
    farmerId: "f3",
  },
  {
    id: "p6",
    name: "Bissap séché",
    category: "Épices",
    pricePerKg: 1200,
    unit: "kg",
    stock: 35,
    minStock: 15,
    sku: "SKU-BIS-006",
    image: "https://images.unsplash.com/photo-1610632380989-680fe40816c6?w=600",
    status: "active",
    ordersThisMonth: 14,
    farmerId: "f2",
  },
  {
    id: "p7",
    name: "Pommes de terre",
    category: "Tubercules",
    pricePerKg: 500,
    unit: "kg",
    stock: 65,
    minStock: 20,
    sku: "SKU-POM-007",
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600",
    status: "active",
    ordersThisMonth: 11,
    farmerId: "f1",
  },
  {
    id: "p8",
    name: "Carottes",
    category: "Légumes",
    pricePerKg: 700,
    unit: "kg",
    stock: 42,
    minStock: 20,
    sku: "SKU-CAR-008",
    image: "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600",
    status: "active",
    ordersThisMonth: 8,
    farmerId: "f1",
  },
];

export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "delivering" | "delivered" | "cancelled";

export type Order = {
  id: string;
  reference: string;
  restaurantId: string;
  farmerId: string;
  driverId?: string;
  items: { productId: string; qty: number; price: number }[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  eta?: string;
};

export const orders: Order[] = [
  {
    id: "o1",
    reference: "CMD-2851",
    restaurantId: "r1",
    farmerId: "f1",
    driverId: "d1",
    items: [
      { productId: "p1", qty: 50, price: 850 },
      { productId: "p2", qty: 30, price: 450 },
    ],
    total: 56000,
    status: "delivering",
    createdAt: "2025-05-15T10:30:00Z",
    eta: "23 min",
  },
  {
    id: "o2",
    reference: "CMD-2850",
    restaurantId: "r2",
    farmerId: "f1",
    items: [{ productId: "p1", qty: 20, price: 850 }],
    total: 17000,
    status: "pending",
    createdAt: "2025-05-15T09:15:00Z",
  },
  {
    id: "o3",
    reference: "CMD-2849",
    restaurantId: "r3",
    farmerId: "f1",
    items: [{ productId: "p3", qty: 15, price: 3200 }],
    total: 48000,
    status: "confirmed",
    createdAt: "2025-05-15T08:00:00Z",
  },
  {
    id: "o4",
    reference: "CMD-2848",
    restaurantId: "r1",
    farmerId: "f2",
    items: [{ productId: "p3", qty: 8, price: 3200 }],
    total: 25600,
    status: "delivered",
    createdAt: "2025-05-14T14:00:00Z",
  },
  {
    id: "o5",
    reference: "CMD-2847",
    restaurantId: "r2",
    farmerId: "f1",
    driverId: "d1",
    items: [
      { productId: "p1", qty: 50, price: 850 },
      { productId: "p2", qty: 30, price: 450 },
    ],
    total: 56000,
    status: "delivered",
    createdAt: "2025-05-14T11:00:00Z",
  },
  {
    id: "o6",
    reference: "CMD-2846",
    restaurantId: "r3",
    farmerId: "f1",
    items: [
      { productId: "p7", qty: 25, price: 500 },
      { productId: "p8", qty: 15, price: 700 },
    ],
    total: 23000,
    status: "pending",
    createdAt: "2025-05-15T11:00:00Z",
  },
];

export const testimonials = [
  {
    name: "Mamadou Diallo",
    role: "Agriculteur, Thiès",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200",
    rating: 5,
    text: "Avant Diambar Agro, je vendais au marché et perdais souvent mes produits. Maintenant j'ai des commandes régulières chaque semaine. Mon revenu a augmenté de 35% en 3 mois.",
  },
  {
    name: "Aminata Ndiaye",
    role: "Propriétaire, Chez Aminata — Thiès",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200",
    rating: 5,
    text: "Je commandais via des intermédiaires qui prenaient une marge énorme. Avec la plateforme, je paie directement le producteur. Mes coûts ont baissé de 20%.",
  },
  {
    name: "Oumar Ba",
    role: "Livreur partenaire, Dakar",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
    rating: 5,
    text: "L'app est simple, les missions arrivent rapidement. Je gère mon planning librement et je suis payé le jour même via Wave. C'est le meilleur job que j'ai eu.",
  },
  {
    name: "Ibrahima Sarr",
    role: "Directeur, Hôtel Téranga",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
    rating: 5,
    text: "Nous approvisionnons notre restaurant directement chez les producteurs locaux. Produits plus frais, traçabilité totale, livraison ponctuelle.",
  },
];

export const faq = [
  {
    q: "Comment m'inscrire sur Diambar Agro ?",
    a: "Cliquez sur \"Commencer maintenant\", choisissez votre rôle (Agriculteur, Restaurant ou Livreur) et suivez le processus d'onboarding guidé en 4 étapes. L'inscription est gratuite.",
  },
  {
    q: "Quels sont les frais de la plateforme ?",
    a: "La plateforme prélève une commission de 5% à 15% sur chaque commande selon le volume. Les frais de livraison varient de 1 000 à 5 000 FCFA selon la distance.",
  },
  {
    q: "Comment fonctionnent les paiements ?",
    a: "Nous acceptons Wave, Orange Money, Free Money et les espèces. Les paiements sont sécurisés et les agriculteurs reçoivent leur argent sous 24h après livraison confirmée.",
  },
  {
    q: "Comment les agriculteurs sont-ils vérifiés ?",
    a: "Chaque agriculteur soumet une pièce d'identité, une preuve d'exploitation et passe par un appel de vérification avec notre équipe. Le processus prend 24 à 48h.",
  },
  {
    q: "Puis-je suivre ma livraison en temps réel ?",
    a: "Oui, dès qu'un livreur prend en charge votre commande, vous pouvez suivre sa position GPS en temps réel depuis votre dashboard restaurant.",
  },
  {
    q: "Que se passe-t-il si les produits ne correspondent pas ?",
    a: "Vous pouvez signaler un problème dans les 2h après livraison. Notre équipe intervient sous 4h et un remboursement ou remplacement est organisé.",
  },
  {
    q: "Est-ce que Diambar Agro couvre toute la région ?",
    a: "Actuellement nous couvrons Dakar et Thiès. Nous allons étendre à Mbour, Saint-Louis et Ziguinchor d'ici fin 2025.",
  },
  {
    q: "Peut-on passer des commandes récurrentes ?",
    a: 'Oui. La fonctionnalité "Commande récurrente" permet aux restaurants de programmer des livraisons hebdomadaires automatiques.',
  },
  {
    q: "Comment devenir livreur partenaire ?",
    a: 'Inscrivez-vous avec le rôle "Livreur", soumettez votre permis de conduire et votre carte d\'identité. Vous pouvez commencer à recevoir des missions sous 48h.',
  },
  {
    q: "Y a-t-il un abonnement premium ?",
    a: "Oui. L'abonnement Premium Restaurant (15 000 FCFA/mois) offre la mise en avant dans les résultats, les commandes récurrentes automatiques et un accès prioritaire au support.",
  },
];

export type PaymentMethod = "Wave" | "Orange Money" | "Free Money" | "Espèces";
export type Transaction = {
  id: string;
  date: string;
  orderRef: string;
  restaurantId: string;
  gross: number;
  commission: number;
  net: number;
  method: PaymentMethod;
  status: "Payé" | "En attente" | "Échec";
};

export const transactions: Transaction[] = [
  {
    id: "t1",
    date: "2025-05-15",
    orderRef: "CMD-2851",
    restaurantId: "r1",
    gross: 56000,
    commission: 5600,
    net: 50400,
    method: "Wave",
    status: "Payé",
  },
  {
    id: "t2",
    date: "2025-05-14",
    orderRef: "CMD-2847",
    restaurantId: "r2",
    gross: 56000,
    commission: 5600,
    net: 50400,
    method: "Orange Money",
    status: "Payé",
  },
  {
    id: "t3",
    date: "2025-05-13",
    orderRef: "CMD-2842",
    restaurantId: "r3",
    gross: 32500,
    commission: 3250,
    net: 29250,
    method: "Wave",
    status: "Payé",
  },
  {
    id: "t4",
    date: "2025-05-12",
    orderRef: "CMD-2838",
    restaurantId: "r1",
    gross: 18000,
    commission: 1800,
    net: 16200,
    method: "Free Money",
    status: "En attente",
  },
  {
    id: "t5",
    date: "2025-05-10",
    orderRef: "CMD-2829",
    restaurantId: "r2",
    gross: 42000,
    commission: 4200,
    net: 37800,
    method: "Wave",
    status: "Payé",
  },
  {
    id: "t6",
    date: "2025-05-08",
    orderRef: "CMD-2820",
    restaurantId: "r3",
    gross: 73000,
    commission: 7300,
    net: 65700,
    method: "Espèces",
    status: "Payé",
  },
];

export type ChatAttachment = { name: string; dataUrl: string; mime: string };

export type Conversation = {
  id: string;
  restaurantId: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  // senderName: renseigné uniquement pour les messages injectés par l'admin
  // depuis la messagerie de supervision, pour ne pas les faire passer pour
  // un message de l'autre partie ("them" seul ne dirait pas que c'est l'admin).
  messages: {
    id: string;
    from: "me" | "them";
    text: string;
    at: string;
    senderName?: string;
    attachment?: ChatAttachment;
  }[];
};

export const conversations: Conversation[] = [
  {
    id: "c1",
    restaurantId: "r1",
    lastMessage: "Parfait, on confirme pour demain matin 8h.",
    lastAt: "2025-05-15T10:42:00Z",
    unread: 2,
    messages: [
      {
        id: "m1",
        from: "them",
        text: "Bonjour Mamadou, vous avez encore des tomates fraîches ?",
        at: "2025-05-15T10:30:00Z",
      },
      {
        id: "m2",
        from: "me",
        text: "Oui chef, j'ai 60kg disponibles ce matin.",
        at: "2025-05-15T10:35:00Z",
      },
      { id: "m3", from: "them", text: "Je prends 50kg.", at: "2025-05-15T10:38:00Z" },
      {
        id: "m4",
        from: "them",
        text: "Parfait, on confirme pour demain matin 8h.",
        at: "2025-05-15T10:42:00Z",
      },
    ],
  },
  {
    id: "c2",
    restaurantId: "r2",
    lastMessage: "Merci pour la livraison, tout est nickel !",
    lastAt: "2025-05-14T18:10:00Z",
    unread: 0,
    messages: [
      {
        id: "m1",
        from: "them",
        text: "Merci pour la livraison, tout est nickel !",
        at: "2025-05-14T18:10:00Z",
      },
      { id: "m2", from: "me", text: "Merci à vous chef Aminata 🙏", at: "2025-05-14T18:12:00Z" },
    ],
  },
  {
    id: "c3",
    restaurantId: "r3",
    lastMessage: "Vous pouvez livrer 20kg d'oignons mardi ?",
    lastAt: "2025-05-13T09:00:00Z",
    unread: 1,
    messages: [
      {
        id: "m1",
        from: "them",
        text: "Vous pouvez livrer 20kg d'oignons mardi ?",
        at: "2025-05-13T09:00:00Z",
      },
    ],
  },
];

export type AppNotification = {
  id: string;
  type: "order" | "payment" | "stock" | "system" | "message";
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export const notifications: AppNotification[] = [
  {
    id: "n1",
    type: "order",
    title: "Nouvelle commande",
    body: "Le Baobab · 56 000 FCFA",
    at: "2025-05-15T11:05:00Z",
    read: false,
  },
  {
    id: "n2",
    type: "payment",
    title: "Paiement reçu",
    body: "Wave · +50 400 FCFA (CMD-2851)",
    at: "2025-05-15T10:50:00Z",
    read: false,
  },
  {
    id: "n3",
    type: "stock",
    title: "Stock faible",
    body: "Oignons rouges : 18kg restant (min 25)",
    at: "2025-05-15T08:30:00Z",
    read: true,
  },
  {
    id: "n4",
    type: "message",
    title: "Nouveau message",
    body: "Chez Aminata vous a écrit",
    at: "2025-05-14T18:10:00Z",
    read: true,
  },
  {
    id: "n5",
    type: "system",
    title: "Mise à jour",
    body: "Nouveau tableau analytics disponible",
    at: "2025-05-13T15:00:00Z",
    read: true,
  },
  {
    id: "n6",
    type: "order",
    title: "Commande livrée",
    body: "CMD-2847 livrée à Chez Aminata",
    at: "2025-05-14T11:30:00Z",
    read: true,
  },
];

export type StockMovement = {
  id: string;
  productId: string;
  type: "in" | "out" | "adjust";
  qty: number;
  reason: string;
  at: string;
  operator: string;
};

export const stockMovements: StockMovement[] = [
  {
    id: "sm1",
    productId: "p1",
    type: "in",
    qty: 50,
    reason: "Récolte du matin",
    at: "2025-05-15T07:00:00Z",
    operator: "Mamadou",
  },
  {
    id: "sm2",
    productId: "p1",
    type: "out",
    qty: 30,
    reason: "Vente CMD-2851",
    at: "2025-05-15T10:30:00Z",
    operator: "Système",
  },
  {
    id: "sm3",
    productId: "p2",
    type: "out",
    qty: 12,
    reason: "Vente CMD-2849",
    at: "2025-05-14T16:20:00Z",
    operator: "Système",
  },
  {
    id: "sm4",
    productId: "p3",
    type: "in",
    qty: 20,
    reason: "Nouvel arrivage",
    at: "2025-05-14T08:00:00Z",
    operator: "Mamadou",
  },
  {
    id: "sm5",
    productId: "p4",
    type: "out",
    qty: 40,
    reason: "Périmé",
    at: "2025-05-13T11:00:00Z",
    operator: "Mamadou",
  },
  {
    id: "sm6",
    productId: "p7",
    type: "adjust",
    qty: 5,
    reason: "Inventaire mensuel",
    at: "2025-05-12T09:00:00Z",
    operator: "Mamadou",
  },
  {
    id: "sm7",
    productId: "p8",
    type: "in",
    qty: 25,
    reason: "Récolte",
    at: "2025-05-11T07:30:00Z",
    operator: "Mamadou",
  },
];

export const wallets = [
  { id: "w1", method: "Wave" as const, balance: 145000, phone: "77 123 45 67", color: "#1DB7FF" },
  {
    id: "w2",
    method: "Orange Money" as const,
    balance: 78500,
    phone: "78 200 33 44",
    color: "#FF6F00",
  },
  {
    id: "w3",
    method: "Free Money" as const,
    balance: 22000,
    phone: "76 555 11 22",
    color: "#CD1F4C",
  },
];

export type Withdrawal = {
  id: string;
  date: string;
  method: PaymentMethod;
  amount: number;
  fee: number;
  status: "Effectué" | "En cours" | "Échec";
  reference: string;
};

export const withdrawals: Withdrawal[] = [
  {
    id: "wd1",
    date: "2025-05-12",
    method: "Wave",
    amount: 200000,
    fee: 1000,
    status: "Effectué",
    reference: "WD-001",
  },
  {
    id: "wd2",
    date: "2025-05-05",
    method: "Orange Money",
    amount: 150000,
    fee: 750,
    status: "Effectué",
    reference: "WD-002",
  },
  {
    id: "wd3",
    date: "2025-04-28",
    method: "Wave",
    amount: 320000,
    fee: 1500,
    status: "Effectué",
    reference: "WD-003",
  },
  {
    id: "wd4",
    date: "2025-05-15",
    method: "Wave",
    amount: 100000,
    fee: 500,
    status: "En cours",
    reference: "WD-004",
  },
];

export type RecurringOrder = {
  id: string;
  restaurantId: string;
  items: { productId: string; qty: number }[];
  frequency: "weekly" | "biweekly" | "monthly";
  dayOfWeek: number;
  active: boolean;
  nextDelivery: string;
};

export const recurringOrders: RecurringOrder[] = [
  {
    id: "ro1",
    restaurantId: "r1",
    items: [
      { productId: "p1", qty: 30 },
      { productId: "p2", qty: 15 },
    ],
    frequency: "weekly",
    dayOfWeek: 1,
    active: true,
    nextDelivery: "2025-05-19",
  },
  {
    id: "ro2",
    restaurantId: "r2",
    items: [{ productId: "p3", qty: 10 }],
    frequency: "biweekly",
    dayOfWeek: 4,
    active: true,
    nextDelivery: "2025-05-22",
  },
  {
    id: "ro3",
    restaurantId: "r3",
    items: [
      { productId: "p7", qty: 25 },
      { productId: "p8", qty: 12 },
    ],
    frequency: "weekly",
    dayOfWeek: 3,
    active: false,
    nextDelivery: "—",
  },
];

// === Restaurant module ===
export type RestaurantOrder = {
  id: string;
  reference: string;
  farmerId: string;
  items: { productId: string; qty: number; price: number }[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  eta?: string;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
};

export const restaurantOrders: RestaurantOrder[] = [
  {
    id: "ro_1",
    reference: "CMD-3051",
    farmerId: "f1",
    items: [
      { productId: "p1", qty: 30, price: 850 },
      { productId: "p8", qty: 10, price: 700 },
    ],
    total: 32500,
    status: "delivering",
    createdAt: "2025-05-15T09:00:00Z",
    eta: "18 min",
    deliveryAddress: "Le Baobab, Dakar Plateau",
    paymentMethod: "Wave",
  },
  {
    id: "ro_2",
    reference: "CMD-3050",
    farmerId: "f2",
    items: [{ productId: "p3", qty: 8, price: 3200 }],
    total: 25600,
    status: "preparing",
    createdAt: "2025-05-15T08:15:00Z",
    deliveryAddress: "Le Baobab, Dakar Plateau",
    paymentMethod: "Orange Money",
  },
  {
    id: "ro_3",
    reference: "CMD-3049",
    farmerId: "f3",
    items: [{ productId: "p5", qty: 40, price: 350 }],
    total: 14000,
    status: "delivered",
    createdAt: "2025-05-14T14:00:00Z",
    deliveryAddress: "Le Baobab, Dakar Plateau",
    paymentMethod: "Wave",
  },
  {
    id: "ro_4",
    reference: "CMD-3048",
    farmerId: "f1",
    items: [
      { productId: "p6", qty: 5, price: 1200 },
      { productId: "p2", qty: 15, price: 450 },
    ],
    total: 12750,
    status: "pending",
    createdAt: "2025-05-15T11:00:00Z",
    deliveryAddress: "Le Baobab, Dakar Plateau",
    paymentMethod: "Free Money",
  },
];

export const suppliers = [
  {
    id: "f1",
    farmerId: "f1",
    name: "Ferme Diallo",
    contact: "Mamadou Diallo",
    phone: "+221 77 123 45 67",
    email: "mamadou@ferme-diallo.sn",
    city: "Thiès",
    notes: "Fournisseur principal légumes.",
    favorite: true,
    suspended: false,
    lastOrder: "2025-05-15",
    totalOrders: 24,
    totalSpent: 845000,
  },
  {
    id: "f2",
    farmerId: "f2",
    name: "Coopérative Sow",
    contact: "Fatou Sow",
    phone: "+221 78 200 33 44",
    email: "contact@coop-sow.sn",
    city: "Dakar-Pikine",
    notes: "Volaille et bissap de qualité.",
    favorite: true,
    suspended: false,
    lastOrder: "2025-05-14",
    totalOrders: 18,
    totalSpent: 612000,
  },
  {
    id: "f3",
    farmerId: "f3",
    name: "Niayes Ndoye",
    contact: "Ibrahima Ndoye",
    phone: "+221 76 555 11 22",
    email: "ibrahima@niayes.sn",
    city: "Mbour",
    notes: "Spécialiste fruits & tubercules.",
    favorite: false,
    suspended: false,
    lastOrder: "2025-05-13",
    totalOrders: 11,
    totalSpent: 423000,
  },
] as Supplier[];

export type Supplier = {
  id: string;
  farmerId?: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  notes?: string;
  favorite: boolean;
  suspended: boolean;
  lastOrder: string;
  totalOrders: number;
  totalSpent: number;
};

export const restaurantNotifications: AppNotification[] = [
  {
    id: "rn1",
    type: "order",
    title: "Commande en livraison",
    body: "CMD-3051 · ETA 18 min",
    at: "2025-05-15T11:30:00Z",
    read: false,
  },
  {
    id: "rn2",
    type: "payment",
    title: "Paiement débité",
    body: "Wave · 32 500 FCFA",
    at: "2025-05-15T09:05:00Z",
    read: false,
  },
  {
    id: "rn3",
    type: "stock",
    title: "Stock faible chez fournisseur",
    body: "Oignons rouges (Mamadou)",
    at: "2025-05-14T16:00:00Z",
    read: true,
  },
  {
    id: "rn4",
    type: "message",
    title: "Réponse de Mamadou",
    body: "OK pour demain 8h",
    at: "2025-05-15T10:42:00Z",
    read: true,
  },
];

// === Driver module ===
export type MissionStatus =
  | "available" // proposée, pas encore acceptée
  | "accepted" // acceptée par le livreur, pas encore commencée
  | "pickup" // en route vers l'agriculteur
  | "loaded" // marchandises récupérées, en route vers restaurant
  | "delivered" // livrée, en attente de confirmation paiement
  | "cancelled";

export type Mission = {
  id: string;
  reference: string;
  orderRef: string;
  farmerId: string;
  restaurantId: string;
  driverId?: string;
  status: MissionStatus;
  pickup: { address: string; city: string; lat: number; lng: number; contactPhone: string };
  dropoff: { address: string; city: string; lat: number; lng: number; contactPhone: string };
  distanceKm: number;
  estimatedMinutes: number;
  payout: number; // FCFA reçus par le livreur
  weightKg: number;
  itemsCount: number;
  scheduledFor: string; // ISO
  createdAt: string;
  vehicleType: "Moto" | "Camionnette" | "Camion" | "Tricycle";
  urgency: "standard" | "priority" | "express";
  proof?: MissionProofPhoto[];
};

export type MissionProofPhoto = {
  id: string;
  name: string;
  size: number;
  mime: string;
  dataUrl?: string;
  at: string;
};

export const missions: Mission[] = [
  // Missions disponibles (marketplace)
  {
    id: "mi1",
    reference: "MIS-4210",
    orderRef: "CMD-3055",
    farmerId: "f1",
    restaurantId: "r1",
    status: "available",
    pickup: {
      address: "Route de Khombole km 3, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 123 45 67",
    },
    dropoff: {
      address: "Place de l'Indépendance, Dakar Plateau",
      city: "Dakar",
      lat: 14.67,
      lng: -17.43,
      contactPhone: "+221 78 900 11 22",
    },
    distanceKm: 72,
    estimatedMinutes: 95,
    payout: 8500,
    weightKg: 45,
    itemsCount: 3,
    scheduledFor: "2025-05-16T08:00:00Z",
    createdAt: "2025-05-15T11:00:00Z",
    vehicleType: "Camionnette",
    urgency: "standard",
  },
  {
    id: "mi2",
    reference: "MIS-4211",
    orderRef: "CMD-3056",
    farmerId: "f2",
    restaurantId: "r2",
    status: "available",
    pickup: {
      address: "Zone maraîchère, Dakar-Pikine",
      city: "Dakar",
      lat: 14.75,
      lng: -17.39,
      contactPhone: "+221 78 200 33 44",
    },
    dropoff: {
      address: "Chez Aminata, Thiès centre",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 555 22 88",
    },
    distanceKm: 68,
    estimatedMinutes: 85,
    payout: 7500,
    weightKg: 22,
    itemsCount: 2,
    scheduledFor: "2025-05-16T10:00:00Z",
    createdAt: "2025-05-15T10:30:00Z",
    vehicleType: "Moto",
    urgency: "priority",
  },
  {
    id: "mi3",
    reference: "MIS-4212",
    orderRef: "CMD-3057",
    farmerId: "f3",
    restaurantId: "r3",
    status: "available",
    pickup: {
      address: "Ferme Niayes, Mbour",
      city: "Mbour",
      lat: 14.42,
      lng: -16.97,
      contactPhone: "+221 76 555 11 22",
    },
    dropoff: {
      address: "Hôtel Téranga, Dakar",
      city: "Dakar",
      lat: 14.67,
      lng: -17.44,
      contactPhone: "+221 77 444 88 99",
    },
    distanceKm: 84,
    estimatedMinutes: 110,
    payout: 12000,
    weightKg: 120,
    itemsCount: 4,
    scheduledFor: "2025-05-16T06:30:00Z",
    createdAt: "2025-05-15T09:45:00Z",
    vehicleType: "Camion",
    urgency: "express",
  },

  // Missions en cours (assignées à d1 = Oumar Ba)
  {
    id: "mi4",
    reference: "MIS-4200",
    orderRef: "CMD-2851",
    farmerId: "f1",
    restaurantId: "r1",
    driverId: "d1",
    status: "loaded",
    pickup: {
      address: "Route de Khombole km 3, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 123 45 67",
    },
    dropoff: {
      address: "Le Baobab, Dakar Plateau",
      city: "Dakar",
      lat: 14.67,
      lng: -17.43,
      contactPhone: "+221 78 900 11 22",
    },
    distanceKm: 72,
    estimatedMinutes: 95,
    payout: 8500,
    weightKg: 80,
    itemsCount: 2,
    scheduledFor: "2025-05-15T08:00:00Z",
    createdAt: "2025-05-15T07:30:00Z",
    vehicleType: "Camionnette",
    urgency: "standard",
  },
  {
    id: "mi5",
    reference: "MIS-4201",
    orderRef: "CMD-2852",
    farmerId: "f2",
    restaurantId: "r2",
    driverId: "d1",
    status: "accepted",
    pickup: {
      address: "Zone maraîchère, Dakar-Pikine",
      city: "Dakar",
      lat: 14.75,
      lng: -17.39,
      contactPhone: "+221 78 200 33 44",
    },
    dropoff: {
      address: "Chez Aminata, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 555 22 88",
    },
    distanceKm: 68,
    estimatedMinutes: 85,
    payout: 7500,
    weightKg: 24,
    itemsCount: 1,
    scheduledFor: "2025-05-15T14:00:00Z",
    createdAt: "2025-05-15T09:00:00Z",
    vehicleType: "Camionnette",
    urgency: "standard",
  },

  // Missions historiques (livrées)
  {
    id: "mi6",
    reference: "MIS-4180",
    orderRef: "CMD-2847",
    farmerId: "f1",
    restaurantId: "r2",
    driverId: "d1",
    status: "delivered",
    pickup: {
      address: "Route de Khombole km 3, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 123 45 67",
    },
    dropoff: {
      address: "Chez Aminata, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 555 22 88",
    },
    distanceKm: 5,
    estimatedMinutes: 15,
    payout: 3500,
    weightKg: 80,
    itemsCount: 2,
    scheduledFor: "2025-05-14T11:00:00Z",
    createdAt: "2025-05-14T10:30:00Z",
    vehicleType: "Camionnette",
    urgency: "standard",
  },
  {
    id: "mi7",
    reference: "MIS-4178",
    orderRef: "CMD-2844",
    farmerId: "f3",
    restaurantId: "r1",
    driverId: "d1",
    status: "delivered",
    pickup: {
      address: "Ferme Niayes, Mbour",
      city: "Mbour",
      lat: 14.42,
      lng: -16.97,
      contactPhone: "+221 76 555 11 22",
    },
    dropoff: {
      address: "Le Baobab, Dakar",
      city: "Dakar",
      lat: 14.67,
      lng: -17.43,
      contactPhone: "+221 78 900 11 22",
    },
    distanceKm: 84,
    estimatedMinutes: 110,
    payout: 12000,
    weightKg: 60,
    itemsCount: 3,
    scheduledFor: "2025-05-13T07:00:00Z",
    createdAt: "2025-05-13T06:30:00Z",
    vehicleType: "Camionnette",
    urgency: "priority",
  },
  {
    id: "mi8",
    reference: "MIS-4175",
    orderRef: "CMD-2838",
    farmerId: "f1",
    restaurantId: "r3",
    driverId: "d1",
    status: "delivered",
    pickup: {
      address: "Route de Khombole km 3, Thiès",
      city: "Thiès",
      lat: 14.79,
      lng: -16.93,
      contactPhone: "+221 77 123 45 67",
    },
    dropoff: {
      address: "Hôtel Téranga, Dakar",
      city: "Dakar",
      lat: 14.67,
      lng: -17.44,
      contactPhone: "+221 77 444 88 99",
    },
    distanceKm: 72,
    estimatedMinutes: 95,
    payout: 8500,
    weightKg: 55,
    itemsCount: 2,
    scheduledFor: "2025-05-12T08:00:00Z",
    createdAt: "2025-05-12T07:30:00Z",
    vehicleType: "Camionnette",
    urgency: "standard",
  },
  {
    id: "mi9",
    reference: "MIS-4170",
    orderRef: "CMD-2830",
    farmerId: "f2",
    restaurantId: "r1",
    driverId: "d1",
    status: "delivered",
    pickup: {
      address: "Zone maraîchère, Dakar-Pikine",
      city: "Dakar",
      lat: 14.75,
      lng: -17.39,
      contactPhone: "+221 78 200 33 44",
    },
    dropoff: {
      address: "Le Baobab, Dakar",
      city: "Dakar",
      lat: 14.67,
      lng: -17.43,
      contactPhone: "+221 78 900 11 22",
    },
    distanceKm: 12,
    estimatedMinutes: 25,
    payout: 4500,
    weightKg: 32,
    itemsCount: 1,
    scheduledFor: "2025-05-11T09:00:00Z",
    createdAt: "2025-05-11T08:30:00Z",
    vehicleType: "Moto",
    urgency: "standard",
  },
];

export type DriverVehicle = {
  type: "Moto" | "Camionnette" | "Camion" | "Tricycle";
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  capacityKg: number;
  insuranceExpiry: string;
  inspectionExpiry: string;
  photo: string;
  nextMaintenanceAt?: string;
};

export type VehicleIssue = {
  id: string;
  description: string;
  at: string;
  status: "reported" | "resolved";
};

export const driverProfile = {
  id: "d1",
  name: "Oumar Ba",
  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200",
  phone: "+221 77 888 99 00",
  email: "oumar@diambar.sn",
  city: "Dakar",
  rating: 4.9,
  totalMissions: 234,
  totalDistanceKm: 12480,
  memberSince: "2024-01-15",
  documents: {
    permitVerified: true,
    idVerified: true,
    insuranceVerified: true,
  },
};

export const driverVehicle: DriverVehicle = {
  type: "Camionnette",
  brand: "Toyota",
  model: "Hilux",
  year: 2019,
  plate: "DK 4587 AB",
  color: "Blanc",
  capacityKg: 800,
  insuranceExpiry: "2026-03-15",
  inspectionExpiry: "2025-11-20",
  photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
};

export const driverNotifications: AppNotification[] = [
  {
    id: "dn1",
    type: "order",
    title: "Nouvelle mission proposée",
    body: "MIS-4212 · Mbour → Dakar · 12 000 FCFA",
    at: "2025-05-15T09:45:00Z",
    read: false,
  },
  {
    id: "dn2",
    type: "payment",
    title: "Paiement reçu",
    body: "Wave · +8 575 FCFA (MIS-4200)",
    at: "2025-05-15T11:30:00Z",
    read: false,
  },
  {
    id: "dn3",
    type: "message",
    title: "Message de Le Baobab",
    body: "Merci pour la livraison !",
    at: "2025-05-15T11:40:00Z",
    read: false,
  },
  {
    id: "dn4",
    type: "system",
    title: "Bonus objectif",
    body: "Complétez 2 missions de plus aujourd'hui pour +2 000 FCFA",
    at: "2025-05-15T08:00:00Z",
    read: true,
  },
  {
    id: "dn5",
    type: "order",
    title: "Mission acceptée",
    body: "MIS-4201 confirmée · pickup 14h",
    at: "2025-05-15T09:15:00Z",
    read: true,
  },
];

export const driverConversations: Conversation[] = [
  {
    id: "dc1",
    restaurantId: "r1",
    lastMessage: "Merci pour la livraison !",
    lastAt: "2025-05-15T11:40:00Z",
    unread: 1,
    messages: [
      {
        id: "m1",
        from: "them",
        text: "Bonjour Oumar, vous êtes loin ?",
        at: "2025-05-15T09:15:00Z",
      },
      { id: "m2", from: "me", text: "Bonjour, je suis à 20 min.", at: "2025-05-15T09:17:00Z" },
      { id: "m3", from: "them", text: "Parfait 👌", at: "2025-05-15T09:18:00Z" },
      { id: "m4", from: "them", text: "Merci pour la livraison !", at: "2025-05-15T11:40:00Z" },
    ],
  },
  {
    id: "dc2",
    restaurantId: "r2",
    lastMessage: "Rdv à 14h devant la ferme.",
    lastAt: "2025-05-15T10:00:00Z",
    unread: 0,
    messages: [
      {
        id: "m1",
        from: "me",
        text: "Bonjour, à quelle heure je passe ?",
        at: "2025-05-15T09:50:00Z",
      },
      { id: "m2", from: "them", text: "Rdv à 14h devant la ferme.", at: "2025-05-15T10:00:00Z" },
    ],
  },
];

/* ---------------- Portefeuille livreur ---------------- */

export type DriverTx = {
  id: string;
  at: string;
  label: string;
  ref?: string;
  kind: "mission" | "bonus" | "commission" | "withdrawal" | "adjustment";
  amount: number; // positif = crédit, négatif = débit
  method?: PaymentMethod;
  status: "Complété" | "En attente" | "Programmé";
};

export const driverTransactions: DriverTx[] = [
  {
    id: "dtx1",
    at: "2025-05-15T11:30:00Z",
    label: "Mission MIS-4200 · Le Baobab",
    ref: "MIS-4200",
    kind: "mission",
    amount: 9000,
    status: "Complété",
  },
  {
    id: "dtx2",
    at: "2025-05-15T11:30:00Z",
    label: "Commission plateforme (5%)",
    ref: "MIS-4200",
    kind: "commission",
    amount: -425,
    status: "Complété",
  },
  {
    id: "dtx3",
    at: "2025-05-14T18:05:00Z",
    label: "Mission MIS-4180 · Chez Aminata",
    ref: "MIS-4180",
    kind: "mission",
    amount: 3500,
    status: "Complété",
  },
  {
    id: "dtx4",
    at: "2025-05-14T18:05:00Z",
    label: "Commission plateforme (5%)",
    ref: "MIS-4180",
    kind: "commission",
    amount: -175,
    status: "Complété",
  },
  {
    id: "dtx5",
    at: "2025-05-13T20:12:00Z",
    label: "Bonus 5 missions / jour",
    kind: "bonus",
    amount: 1500,
    status: "Complété",
  },
  {
    id: "dtx6",
    at: "2025-05-12T09:00:00Z",
    label: "Retrait Wave",
    kind: "withdrawal",
    amount: -45000,
    method: "Wave",
    status: "Complété",
  },
  {
    id: "dtx7",
    at: "2025-05-11T16:40:00Z",
    label: "Mission MIS-4170 · Le Baobab",
    ref: "MIS-4170",
    kind: "mission",
    amount: 4500,
    status: "Complété",
  },
  {
    id: "dtx8",
    at: "2025-05-10T14:20:00Z",
    label: "Retrait Orange Money",
    kind: "withdrawal",
    amount: -30000,
    method: "Orange Money",
    status: "En attente",
  },
];

export type DriverWallet = {
  balance: number;
  pending: number;
  withdrawn: number;
  transactions: DriverTx[];
};

export const driverWallet: DriverWallet = {
  balance: 187500,
  pending: 8575,
  withdrawn: 412000,
  transactions: driverTransactions,
};

export type DriverPaymentMethod = {
  id: string;
  method: PaymentMethod;
  label: string;
  active: boolean;
};

export type DriverSettings = {
  profile: { name: string; phone: string; email: string; city: string; avatar: string };
  radius: number;
  autoAccept: boolean;
  notif: {
    push: boolean;
    sms: boolean;
    email: boolean;
    missions: boolean;
    payments: boolean;
    messages: boolean;
  };
  payoutFrequency: "daily" | "weekly" | "manual";
  paymentMethods: DriverPaymentMethod[];
};

export const driverSettings: DriverSettings = {
  profile: {
    name: driverProfile.name,
    phone: driverProfile.phone,
    email: driverProfile.email,
    city: driverProfile.city,
    avatar: driverProfile.avatar,
  },
  radius: 50,
  autoAccept: false,
  notif: { push: true, sms: true, email: false, missions: true, payments: true, messages: true },
  payoutFrequency: "weekly",
  paymentMethods: [{ id: "pm1", method: "Wave", label: driverProfile.phone, active: true }],
};
