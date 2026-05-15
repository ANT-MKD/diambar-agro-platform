// Mock data centralisée pour DIAMBAR AGRO — sera remplacée par Supabase

export type Role = "farmer" | "restaurant" | "driver" | "admin";

export const cities = ["Dakar", "Thiès", "Mbour", "Saint-Louis", "Ziguinchor"] as const;

export const farmers = [
  { id: "f1", name: "Mamadou Diallo", city: "Thiès", farm: "Ferme Diallo", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200", rating: 4.9, products: 8, verified: true },
  { id: "f2", name: "Fatou Sow", city: "Dakar-Pikine", farm: "Coopérative Sow", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200", rating: 4.8, products: 6, verified: true },
  { id: "f3", name: "Ibrahima Ndoye", city: "Mbour", farm: "Niayes Ndoye", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200", rating: 4.7, products: 5, verified: true },
];

export const restaurants = [
  { id: "r1", name: "Le Baobab", city: "Dakar Plateau", type: "Sénégalaise", avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200" },
  { id: "r2", name: "Chez Aminata", city: "Thiès", type: "Sénégalaise", avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200" },
  { id: "r3", name: "Restaurant Téranga", city: "Dakar", type: "Hôtel", avatar: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200" },
];

export const drivers = [
  { id: "d1", name: "Oumar Ba", vehicle: "Moto", rating: 4.9, missions: 234, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200" },
  { id: "d2", name: "Cheikh Fall", vehicle: "Camionnette", rating: 4.7, missions: 156, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200" },
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
  { id: "p1", name: "Tomates fraîches", category: "Légumes", pricePerKg: 850, unit: "kg", stock: 47, minStock: 30, sku: "SKU-TOM-001", image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600", status: "active", ordersThisMonth: 12, farmerId: "f1" },
  { id: "p2", name: "Oignons rouges", category: "Légumes", pricePerKg: 450, unit: "kg", stock: 18, minStock: 25, sku: "SKU-OIG-002", image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=600", status: "low", ordersThisMonth: 9, farmerId: "f1" },
  { id: "p3", name: "Poulet fermier", category: "Volaille", pricePerKg: 3200, unit: "kg", stock: 80, minStock: 20, sku: "SKU-POU-003", image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=600", status: "active", ordersThisMonth: 22, farmerId: "f2" },
  { id: "p4", name: "Mangues Kent", category: "Fruits", pricePerKg: 600, unit: "kg", stock: 0, minStock: 40, sku: "SKU-MAN-004", image: "https://images.unsplash.com/photo-1605027990121-cbae9e0642db?w=600", status: "out", ordersThisMonth: 5, farmerId: "f3" },
  { id: "p5", name: "Manioc", category: "Tubercules", pricePerKg: 350, unit: "kg", stock: 120, minStock: 30, sku: "SKU-MAN-005", image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600", status: "active", ordersThisMonth: 7, farmerId: "f3" },
  { id: "p6", name: "Bissap séché", category: "Épices", pricePerKg: 1200, unit: "kg", stock: 35, minStock: 15, sku: "SKU-BIS-006", image: "https://images.unsplash.com/photo-1610632380989-680fe40816c6?w=600", status: "active", ordersThisMonth: 14, farmerId: "f2" },
  { id: "p7", name: "Pommes de terre", category: "Tubercules", pricePerKg: 500, unit: "kg", stock: 65, minStock: 20, sku: "SKU-POM-007", image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600", status: "active", ordersThisMonth: 11, farmerId: "f1" },
  { id: "p8", name: "Carottes", category: "Légumes", pricePerKg: 700, unit: "kg", stock: 42, minStock: 20, sku: "SKU-CAR-008", image: "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600", status: "active", ordersThisMonth: 8, farmerId: "f1" },
];

export type OrderStatus = "pending" | "confirmed" | "preparing" | "delivering" | "delivered" | "cancelled";

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
  { id: "o1", reference: "CMD-2851", restaurantId: "r1", farmerId: "f1", driverId: "d1", items: [{ productId: "p1", qty: 50, price: 850 }, { productId: "p2", qty: 30, price: 450 }], total: 56000, status: "delivering", createdAt: "2025-05-15T10:30:00Z", eta: "23 min" },
  { id: "o2", reference: "CMD-2850", restaurantId: "r2", farmerId: "f1", items: [{ productId: "p1", qty: 20, price: 850 }], total: 17000, status: "pending", createdAt: "2025-05-15T09:15:00Z" },
  { id: "o3", reference: "CMD-2849", restaurantId: "r3", farmerId: "f1", items: [{ productId: "p3", qty: 15, price: 3200 }], total: 48000, status: "confirmed", createdAt: "2025-05-15T08:00:00Z" },
  { id: "o4", reference: "CMD-2848", restaurantId: "r1", farmerId: "f2", items: [{ productId: "p3", qty: 8, price: 3200 }], total: 25600, status: "delivered", createdAt: "2025-05-14T14:00:00Z" },
  { id: "o5", reference: "CMD-2847", restaurantId: "r2", farmerId: "f1", driverId: "d1", items: [{ productId: "p1", qty: 50, price: 850 }, { productId: "p2", qty: 30, price: 450 }], total: 56000, status: "delivered", createdAt: "2025-05-14T11:00:00Z" },
  { id: "o6", reference: "CMD-2846", restaurantId: "r3", farmerId: "f1", items: [{ productId: "p7", qty: 25, price: 500 }, { productId: "p8", qty: 15, price: 700 }], total: 23000, status: "pending", createdAt: "2025-05-15T11:00:00Z" },
];

export const testimonials = [
  { name: "Mamadou Diallo", role: "Agriculteur, Thiès", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200", rating: 5, text: "Avant Diambar Agro, je vendais au marché et perdais souvent mes produits. Maintenant j'ai des commandes régulières chaque semaine. Mon revenu a augmenté de 35% en 3 mois." },
  { name: "Aminata Ndiaye", role: "Propriétaire, Chez Aminata — Thiès", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200", rating: 5, text: "Je commandais via des intermédiaires qui prenaient une marge énorme. Avec la plateforme, je paie directement le producteur. Mes coûts ont baissé de 20%." },
  { name: "Oumar Ba", role: "Livreur partenaire, Dakar", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200", rating: 5, text: "L'app est simple, les missions arrivent rapidement. Je gère mon planning librement et je suis payé le jour même via Wave. C'est le meilleur job que j'ai eu." },
  { name: "Ibrahima Sarr", role: "Directeur, Hôtel Téranga", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200", rating: 5, text: "Nous approvisionnons notre restaurant directement chez les producteurs locaux. Produits plus frais, traçabilité totale, livraison ponctuelle." },
];

export const faq = [
  { q: "Comment m'inscrire sur Diambar Agro ?", a: "Cliquez sur \"Commencer maintenant\", choisissez votre rôle (Agriculteur, Restaurant ou Livreur) et suivez le processus d'onboarding guidé en 4 étapes. L'inscription est gratuite." },
  { q: "Quels sont les frais de la plateforme ?", a: "La plateforme prélève une commission de 5% à 15% sur chaque commande selon le volume. Les frais de livraison varient de 1 000 à 5 000 FCFA selon la distance." },
  { q: "Comment fonctionnent les paiements ?", a: "Nous acceptons Wave, Orange Money, Free Money et les espèces. Les paiements sont sécurisés et les agriculteurs reçoivent leur argent sous 24h après livraison confirmée." },
  { q: "Comment les agriculteurs sont-ils vérifiés ?", a: "Chaque agriculteur soumet une pièce d'identité, une preuve d'exploitation et passe par un appel de vérification avec notre équipe. Le processus prend 24 à 48h." },
  { q: "Puis-je suivre ma livraison en temps réel ?", a: "Oui, dès qu'un livreur prend en charge votre commande, vous pouvez suivre sa position GPS en temps réel depuis votre dashboard restaurant." },
  { q: "Que se passe-t-il si les produits ne correspondent pas ?", a: "Vous pouvez signaler un problème dans les 2h après livraison. Notre équipe intervient sous 4h et un remboursement ou remplacement est organisé." },
  { q: "Est-ce que Diambar Agro couvre toute la région ?", a: "Actuellement nous couvrons Dakar et Thiès. Nous allons étendre à Mbour, Saint-Louis et Ziguinchor d'ici fin 2025." },
  { q: "Peut-on passer des commandes récurrentes ?", a: "Oui. La fonctionnalité \"Commande récurrente\" permet aux restaurants de programmer des livraisons hebdomadaires automatiques." },
  { q: "Comment devenir livreur partenaire ?", a: "Inscrivez-vous avec le rôle \"Livreur\", soumettez votre permis de conduire et votre carte d'identité. Vous pouvez commencer à recevoir des missions sous 48h." },
  { q: "Y a-t-il un abonnement premium ?", a: "Oui. L'abonnement Premium Restaurant (15 000 FCFA/mois) offre la mise en avant dans les résultats, les commandes récurrentes automatiques et un accès prioritaire au support." },
];

export const revenueChart = [
  { day: "01", revenue: 22000, orders: 3 },
  { day: "03", revenue: 31000, orders: 4 },
  { day: "05", revenue: 28000, orders: 4 },
  { day: "07", revenue: 45000, orders: 6 },
  { day: "09", revenue: 38000, orders: 5 },
  { day: "11", revenue: 52000, orders: 7 },
  { day: "13", revenue: 47000, orders: 6 },
  { day: "15", revenue: 63000, orders: 8 },
  { day: "17", revenue: 55000, orders: 7 },
  { day: "19", revenue: 71000, orders: 9 },
  { day: "21", revenue: 68000, orders: 9 },
  { day: "23", revenue: 82000, orders: 11 },
  { day: "25", revenue: 75000, orders: 10 },
  { day: "27", revenue: 91000, orders: 12 },
  { day: "29", revenue: 88000, orders: 11 },
];
