import { Bell, CreditCard, Info, MessageSquare, Package, Truck, Warehouse } from "lucide-react";

// Icône et couleur de chaque type de notification (centre de notifications,
// alertes du tableau de bord).
export const NOTIF_ICONS: Record<string, typeof Bell> = {
  order: Package,
  payment: CreditCard,
  stock: Warehouse,
  system: Info,
  message: MessageSquare,
  mission: Truck,
};
export const NOTIF_TONES: Record<string, string> = {
  order: "bg-blue-500/10 text-blue-500",
  payment: "bg-emerald-500/10 text-emerald-500",
  stock: "bg-amber-500/10 text-amber-500",
  system: "bg-violet-500/10 text-violet-500",
  message: "bg-rose-500/10 text-rose-500",
  mission: "bg-sky-500/10 text-sky-500",
};
