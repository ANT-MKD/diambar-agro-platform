// Données mock de l'espace Admin — remplacées par Lovable Cloud plus tard
import type { Role } from "./mocks";

export type PlatformUserStatus = "active" | "pending" | "suspended" | "rejected";

export type PlatformUser = {
  id: string;
  name: string;
  role: Role;
  email: string;
  phone: string;
  city: string;
  avatar: string;
  status: PlatformUserStatus;
  verified: boolean;
  joinedAt: string;
  lastActiveAt: string;
  orders: number;
  gmv: number;
  rating: number;
};

export const platformUsers: PlatformUser[] = [
  {
    id: "u1",
    name: "Mamadou Diallo",
    role: "farmer",
    email: "mamadou@ferme-diallo.sn",
    phone: "+221 77 123 45 67",
    city: "Thiès",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-11-03",
    lastActiveAt: "2025-05-15T11:20:00Z",
    orders: 142,
    gmv: 4820000,
    rating: 4.9,
  },
  {
    id: "u2",
    name: "Fatou Sow",
    role: "farmer",
    email: "contact@coop-sow.sn",
    phone: "+221 78 200 33 44",
    city: "Dakar-Pikine",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-12-12",
    lastActiveAt: "2025-05-15T09:02:00Z",
    orders: 96,
    gmv: 3120000,
    rating: 4.8,
  },
  {
    id: "u3",
    name: "Ibrahima Ndoye",
    role: "farmer",
    email: "ibrahima@niayes.sn",
    phone: "+221 76 555 11 22",
    city: "Mbour",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120",
    status: "active",
    verified: true,
    joinedAt: "2025-01-08",
    lastActiveAt: "2025-05-14T18:40:00Z",
    orders: 61,
    gmv: 1980000,
    rating: 4.7,
  },
  {
    id: "u4",
    name: "Awa Camara",
    role: "farmer",
    email: "awa.camara@gmail.com",
    phone: "+221 70 411 08 12",
    city: "Saint-Louis",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120",
    status: "pending",
    verified: false,
    joinedAt: "2025-05-14",
    lastActiveAt: "2025-05-15T07:10:00Z",
    orders: 0,
    gmv: 0,
    rating: 0,
  },
  {
    id: "u5",
    name: "Le Baobab",
    role: "restaurant",
    email: "contact@lebaobab.sn",
    phone: "+221 78 900 11 22",
    city: "Dakar Plateau",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-10-21",
    lastActiveAt: "2025-05-15T11:45:00Z",
    orders: 214,
    gmv: 6410000,
    rating: 4.9,
  },
  {
    id: "u6",
    name: "Chez Aminata",
    role: "restaurant",
    email: "aminata@chez-aminata.sn",
    phone: "+221 77 555 22 88",
    city: "Thiès",
    avatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-11-30",
    lastActiveAt: "2025-05-15T08:30:00Z",
    orders: 158,
    gmv: 4180000,
    rating: 4.8,
  },
  {
    id: "u7",
    name: "Hôtel Téranga",
    role: "restaurant",
    email: "achats@teranga.sn",
    phone: "+221 77 444 88 99",
    city: "Dakar",
    avatar: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120",
    status: "active",
    verified: true,
    joinedAt: "2025-02-02",
    lastActiveAt: "2025-05-13T16:00:00Z",
    orders: 74,
    gmv: 3960000,
    rating: 4.6,
  },
  {
    id: "u8",
    name: "Dibiterie Keur Massar",
    role: "restaurant",
    email: "keurmassar.dib@gmail.com",
    phone: "+221 76 330 44 10",
    city: "Dakar",
    avatar: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=120",
    status: "suspended",
    verified: true,
    joinedAt: "2025-01-19",
    lastActiveAt: "2025-04-28T12:00:00Z",
    orders: 22,
    gmv: 410000,
    rating: 3.4,
  },
  {
    id: "u9",
    name: "Oumar Ba",
    role: "driver",
    email: "oumar@diambar.sn",
    phone: "+221 77 888 99 00",
    city: "Dakar",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-11-11",
    lastActiveAt: "2025-05-15T11:50:00Z",
    orders: 234,
    gmv: 1890000,
    rating: 4.9,
  },
  {
    id: "u10",
    name: "Cheikh Fall",
    role: "driver",
    email: "cheikh.fall@diambar.sn",
    phone: "+221 78 121 65 43",
    city: "Thiès",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120",
    status: "active",
    verified: true,
    joinedAt: "2025-01-05",
    lastActiveAt: "2025-05-15T10:05:00Z",
    orders: 156,
    gmv: 1240000,
    rating: 4.7,
  },
  {
    id: "u11",
    name: "Modou Sarr",
    role: "driver",
    email: "modou.sarr@gmail.com",
    phone: "+221 70 987 12 33",
    city: "Mbour",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120",
    status: "pending",
    verified: false,
    joinedAt: "2025-05-15",
    lastActiveAt: "2025-05-15T06:20:00Z",
    orders: 0,
    gmv: 0,
    rating: 0,
  },
  {
    id: "u12",
    name: "Ndeye Gueye",
    role: "driver",
    email: "ndeye.gueye@gmail.com",
    phone: "+221 77 654 09 88",
    city: "Dakar",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120",
    status: "rejected",
    verified: false,
    joinedAt: "2025-04-02",
    lastActiveAt: "2025-04-03T09:00:00Z",
    orders: 0,
    gmv: 0,
    rating: 0,
  },
  {
    id: "u13",
    name: "Admin Diambar",
    role: "admin",
    email: "admin@diambar.sn",
    phone: "+221 77 000 00 00",
    city: "Dakar",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
    status: "active",
    verified: true,
    joinedAt: "2024-09-01",
    lastActiveAt: "2025-05-15T12:00:00Z",
    orders: 0,
    gmv: 0,
    rating: 0,
  },
];

export type ValidationDoc = { label: string; file: string; ok: boolean; note?: string };

export type ValidationStatus = "pending" | "needs_correction" | "approved" | "rejected";

export type ValidationRequest = {
  id: string;
  userId: string;
  type: "farmer" | "driver" | "restaurant";
  submittedAt: string;
  status: ValidationStatus;
  docs: ValidationDoc[];
  note?: string;
};

export const validationRequests: ValidationRequest[] = [
  {
    id: "v1",
    userId: "u4",
    type: "farmer",
    submittedAt: "2025-05-14T15:20:00Z",
    status: "pending",
    docs: [
      { label: "Carte nationale d'identité", file: "cni-awa-camara.pdf", ok: true },
      { label: "Attestation d'exploitation", file: "exploitation-saint-louis.pdf", ok: true },
      { label: "Photos de la parcelle", file: "parcelle-01.jpg", ok: false },
    ],
  },
  {
    id: "v2",
    userId: "u11",
    type: "driver",
    submittedAt: "2025-05-15T06:10:00Z",
    status: "needs_correction",
    docs: [
      { label: "Permis de conduire", file: "permis-modou-sarr.pdf", ok: true },
      { label: "Carte grise", file: "carte-grise-moto.pdf", ok: true },
      {
        label: "Assurance véhicule",
        file: "assurance-2025.pdf",
        ok: false,
        note: "Document expiré — attestation datée de 2023.",
      },
    ],
  },
  {
    id: "v3",
    userId: "u12",
    type: "driver",
    submittedAt: "2025-04-02T10:00:00Z",
    status: "rejected",
    docs: [{ label: "Permis de conduire", file: "permis-illisible.jpg", ok: false }],
    note: "Documents illisibles, relance envoyée sans réponse.",
  },
  {
    id: "v4",
    userId: "u1",
    type: "farmer",
    submittedAt: "2024-11-02T09:00:00Z",
    status: "approved",
    docs: [
      { label: "Carte nationale d'identité", file: "cni-mamadou-diallo.pdf", ok: true },
      { label: "Attestation d'exploitation", file: "exploitation-thies.pdf", ok: true },
      { label: "Photos de la parcelle", file: "parcelle-diallo-01.jpg", ok: true },
    ],
  },
];

export type AuditLog = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  level: "info" | "warning" | "critical";
};

export const auditLogs: AuditLog[] = [
  {
    id: "al1",
    at: "2025-05-15T11:52:00Z",
    actor: "Admin Diambar",
    action: "Validation compte agriculteur",
    target: "Awa Camara (u4)",
    level: "info",
  },
  {
    id: "al2",
    at: "2025-05-15T10:30:00Z",
    actor: "Système",
    action: "Commission ajustée automatiquement",
    target: "Palier Volume > 500k",
    level: "info",
  },
  {
    id: "al3",
    at: "2025-05-15T09:41:00Z",
    actor: "Le Baobab",
    action: "Ouverture d'un litige",
    target: "LIT-0142",
    level: "warning",
  },
  {
    id: "al4",
    at: "2025-05-14T18:12:00Z",
    actor: "Admin Diambar",
    action: "Suspension de compte",
    target: "Dibiterie Keur Massar (u8)",
    level: "critical",
  },
  {
    id: "al5",
    at: "2025-05-14T14:02:00Z",
    actor: "Système",
    action: "Payout hebdomadaire exécuté",
    target: "38 bénéficiaires · 4 820 000 FCFA",
    level: "info",
  },
  {
    id: "al6",
    at: "2025-05-13T16:20:00Z",
    actor: "Admin Diambar",
    action: "Produit dépublié (modération)",
    target: "Mangues Kent (p4)",
    level: "warning",
  },
  {
    id: "al7",
    at: "2025-05-12T08:00:00Z",
    actor: "Admin Diambar",
    action: "Mise à jour des frais de livraison",
    target: "Zone Thiès → Dakar",
    level: "info",
  },
];

export const commissionTiers = [
  {
    id: "ct1",
    label: "Standard",
    range: "0 – 250 000 FCFA / mois",
    rate: 15,
    min: 0,
    max: 250_000,
  },
  {
    id: "ct2",
    label: "Volume",
    range: "250 001 – 500 000 FCFA / mois",
    rate: 12,
    min: 250_001,
    max: 500_000,
  },
  {
    id: "ct3",
    label: "Volume +",
    range: "500 001 – 1 500 000 FCFA / mois",
    rate: 8,
    min: 500_001,
    max: 1_500_000,
  },
  {
    id: "ct4",
    label: "Partenaire",
    range: "> 1 500 000 FCFA / mois",
    rate: 5,
    min: 1_500_001,
    max: null,
  },
];

// Seuil au-delà duquel une justification écrite est obligatoire pour
// approuver un remboursement — remplace la chaîne d'approbateurs fictive
// (support/responsable/administrateur) qui supposerait plusieurs comptes
// admin alors que la démo n'en modélise qu'un seul.
export const refundSettings = {
  justificationThreshold: 50_000,
};

export const deliveryZones = [
  { id: "dz1", name: "Dakar intra-muros", baseFee: 1000, perKm: 120, active: true },
  { id: "dz2", name: "Dakar → Thiès", baseFee: 3500, perKm: 95, active: true },
  { id: "dz3", name: "Dakar → Mbour", baseFee: 4000, perKm: 95, active: true },
  { id: "dz4", name: "Saint-Louis", baseFee: 6000, perKm: 85, active: false },
  { id: "dz5", name: "Ziguinchor", baseFee: 8500, perKm: 80, active: false },
];

export type Payout = {
  id: string;
  reference: string;
  beneficiary: string;
  role: Role;
  amount: number;
  method: "Wave" | "Orange Money" | "Free Money" | "Virement";
  status: "Payé" | "En cours" | "Échec";
  date: string;
};

export const payouts: Payout[] = [
  {
    id: "po1",
    reference: "PAY-2051",
    beneficiary: "Mamadou Diallo",
    role: "farmer",
    amount: 482000,
    method: "Wave",
    status: "Payé",
    date: "2025-05-14",
  },
  {
    id: "po2",
    reference: "PAY-2052",
    beneficiary: "Fatou Sow",
    role: "farmer",
    amount: 316000,
    method: "Orange Money",
    status: "Payé",
    date: "2025-05-14",
  },
  {
    id: "po3",
    reference: "PAY-2053",
    beneficiary: "Oumar Ba",
    role: "driver",
    amount: 128500,
    method: "Wave",
    status: "En cours",
    date: "2025-05-15",
  },
  {
    id: "po4",
    reference: "PAY-2054",
    beneficiary: "Ibrahima Ndoye",
    role: "farmer",
    amount: 198000,
    method: "Free Money",
    status: "Payé",
    date: "2025-05-13",
  },
  {
    id: "po5",
    reference: "PAY-2055",
    beneficiary: "Cheikh Fall",
    role: "driver",
    amount: 94000,
    method: "Wave",
    status: "Échec",
    date: "2025-05-12",
  },
];

export type ModerationReport = { by: string; reason: string; at: string };
export type ModerationEventEntry = { at: string; actor: string; label: string };

export type ModerationItem = {
  id: string;
  productId: string;
  name: string;
  farmer: string;
  image: string;
  price: number;
  // Plusieurs restaurants peuvent signaler le même produit indépendamment :
  // on garde chaque signalement (qui, pourquoi, quand) plutôt qu'un motif
  // unique qui écraserait les signalements suivants.
  reports: ModerationReport[];
  status: "pending" | "approved" | "removed";
  events: ModerationEventEntry[];
};

export const moderationQueue: ModerationItem[] = [
  {
    id: "mo1",
    productId: "p4",
    name: "Mangues Kent",
    farmer: "Niayes Ndoye",
    image: "https://images.unsplash.com/photo-1605027990121-cbae9e0642db?w=400",
    price: 600,
    reports: [
      { by: "Le Baobab", reason: "Photo non représentative", at: "2025-05-12T10:00:00Z" },
      { by: "Chez Aminata", reason: "Photo non représentative", at: "2025-05-13T15:00:00Z" },
    ],
    status: "pending",
    events: [
      { at: "2025-05-11T08:00:00Z", actor: "Niayes Ndoye", label: "Produit publié" },
      { at: "2025-05-12T10:00:00Z", actor: "Le Baobab", label: "1er signalement" },
      { at: "2025-05-13T15:00:00Z", actor: "Chez Aminata", label: "2e signalement" },
    ],
  },
  {
    id: "mo2",
    productId: "p6",
    name: "Bissap séché",
    farmer: "Coopérative Sow",
    image: "https://images.unsplash.com/photo-1610632380989-680fe40816c6?w=400",
    price: 1200,
    reports: [
      { by: "Hôtel Téranga", reason: "Prix suspect (−60% du marché)", at: "2025-05-12T09:30:00Z" },
    ],
    status: "pending",
    events: [
      { at: "2025-05-09T08:00:00Z", actor: "Coopérative Sow", label: "Produit publié" },
      { at: "2025-05-12T09:30:00Z", actor: "Hôtel Téranga", label: "1er signalement" },
    ],
  },
  {
    id: "mo3",
    productId: "p2",
    name: "Oignons rouges",
    farmer: "Ferme Diallo",
    image: "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=400",
    price: 450,
    reports: [{ by: "Le Baobab", reason: "Description incomplète", at: "2025-05-10T11:00:00Z" }],
    status: "approved",
    events: [
      { at: "2025-05-08T08:00:00Z", actor: "Ferme Diallo", label: "Produit publié" },
      { at: "2025-05-10T11:00:00Z", actor: "Le Baobab", label: "1er signalement" },
      { at: "2025-05-10T16:00:00Z", actor: "Admin Diambar", label: "Produit conservé" },
    ],
  },
];
