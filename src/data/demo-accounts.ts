import type { Role } from "./mocks";

export type DemoAccount = {
  role: Role;
  email: string;
  password: string;
  name: string;
  avatar: string;
  redirect: string;
  emoji: string;
  tone: string;
};

export const demoAccounts: DemoAccount[] = [
  {
    role: "farmer",
    email: "agriculteur@diambar.sn",
    password: "demo1234",
    name: "Mamadou Diallo",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=120",
    redirect: "/farmer/dashboard",
    emoji: "🌾",
    tone: "from-emerald-500/20 to-emerald-500/0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  },
  {
    role: "restaurant",
    email: "restaurant@diambar.sn",
    password: "demo1234",
    name: "Le Baobab",
    avatar: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120",
    redirect: "/restaurant/dashboard",
    emoji: "🍽️",
    tone: "from-amber-500/20 to-amber-500/0 border-amber-500/40 text-amber-600 dark:text-amber-400",
  },
  {
    role: "driver",
    email: "livreur@diambar.sn",
    password: "demo1234",
    name: "Oumar Ba",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120",
    redirect: "/driver/dashboard",
    emoji: "🚚",
    tone: "from-blue-500/20 to-blue-500/0 border-blue-500/40 text-blue-600 dark:text-blue-400",
  },
  {
    role: "admin",
    email: "admin@diambar.sn",
    password: "demo1234",
    name: "Admin Diambar",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120",
    redirect: "/farmer/dashboard",
    emoji: "🛡️",
    tone: "from-violet-500/20 to-violet-500/0 border-violet-500/40 text-violet-600 dark:text-violet-400",
  },
];

export function getDemoSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("diambar.session");
    return raw ? (JSON.parse(raw) as { role: Role; email: string }) : null;
  } catch {
    return null;
  }
}