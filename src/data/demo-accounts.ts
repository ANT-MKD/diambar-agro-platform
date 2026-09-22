import type { Role } from "./mocks";

export type DemoAccount = {
  role: Role;
  email: string;
  password: string;
  name: string;
  avatar: string;
  emoji: string;
  tone: string;
  label?: string;
  /** Exige un code de vérification après le mot de passe avant de créer la session. */
  twoFaEnabled?: boolean;
  /**
   * "test" = compte de démonstration des états bloqués (suspendu, en
   * attente…), affiché séparément du grid principal pour ne pas le confondre
   * avec un raccourci vers un vrai tableau de bord.
   */
  kind?: "test";
};

export const demoAccounts: DemoAccount[] = [
  {
    role: "farmer",
    email: "agriculteur@diambar.sn",
    password: "demo1234",
    name: "Mamadou Diallo",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120",
    emoji: "🌾",
    tone: "from-emerald-500/20 to-emerald-500/0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  {
    role: "restaurant",
    email: "restaurant@diambar.sn",
    password: "demo1234",
    name: "Le Baobab",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    emoji: "🍽️",
    tone: "from-amber-500/20 to-amber-500/0 border-amber-500/40 text-amber-600 dark:text-amber-400",
  },
  {
    role: "driver",
    email: "livreur@diambar.sn",
    password: "demo1234",
    name: "Oumar Ba",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120",
    emoji: "🚚",
    tone: "from-blue-500/20 to-blue-500/0 border-blue-500/40 text-blue-600 dark:text-blue-400",
  },
  {
    role: "admin",
    email: "admin@diambar.sn",
    password: "demo1234",
    name: "Admin Diambar",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
    emoji: "🛡️",
    tone: "from-violet-500/20 to-violet-500/0 border-violet-500/40 text-violet-600 dark:text-violet-400",
    label: "Super Administrateur",
    twoFaEnabled: true,
  },
  {
    role: "admin",
    email: "finance@diambar.sn",
    password: "demo1234",
    name: "Fatou Ndiaye",
    avatar: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120",
    emoji: "💰",
    tone: "from-violet-500/20 to-violet-500/0 border-violet-500/40 text-violet-600 dark:text-violet-400",
    label: "Finance",
  },
  {
    role: "admin",
    email: "ops@diambar.sn",
    password: "demo1234",
    name: "Ibrahima Fall",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120",
    emoji: "🧭",
    tone: "from-violet-500/20 to-violet-500/0 border-violet-500/40 text-violet-600 dark:text-violet-400",
    label: "Opérations",
  },
  // Comptes de test pour les états de connexion bloqués — réutilisent des
  // profils déjà présents dans platformUsers (admin-mocks.ts) avec un statut
  // "pending"/"suspended", pour démontrer le vrai blocage plutôt qu'une
  // maquette. Non affichés dans le grid de connexion 1-clic principal.
  {
    role: "farmer",
    email: "awa.camara@gmail.com",
    password: "demo1234",
    name: "Awa Camara",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120",
    emoji: "⏳",
    tone: "from-amber-500/20 to-amber-500/0 border-amber-500/40 text-amber-600 dark:text-amber-400",
    label: "Compte en attente",
    kind: "test",
  },
  {
    role: "restaurant",
    email: "keurmassar.dib@gmail.com",
    password: "demo1234",
    name: "Dibiterie Keur Massar",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    emoji: "⛔",
    tone: "from-destructive/20 to-destructive/0 border-destructive/40 text-destructive",
    label: "Compte suspendu",
    kind: "test",
  },
];
