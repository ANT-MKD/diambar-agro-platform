import type { Mission } from "@/data/mocks";

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function addDays(dayIso: string, delta: number) {
  return dayKey(new Date(new Date(dayIso).getTime() + delta * 86400_000).toISOString());
}

export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

/**
 * Les missions de démo sont figées dans le passé : on ancre "aujourd'hui"
 * sur le jour de la dernière mission réellement assignée au livreur
 * (plutôt que la date système, qui donnerait des pages vides), même
 * principe déjà utilisé pour les tableaux de bord restaurant/agriculteur.
 */
export function referenceDay(missions: Mission[], driverId = "d1") {
  const assigned = missions.filter((m) => m.driverId === driverId && m.status !== "cancelled");
  if (assigned.length === 0) {
    const now = new Date().toISOString();
    return { today: dayKey(now), yesterday: addDays(dayKey(now), -1) };
  }
  const latest = assigned.reduce((a, b) => (a.scheduledFor > b.scheduledFor ? a : b));
  const t = dayKey(latest.scheduledFor);
  return { today: t, yesterday: addDays(t, -1) };
}

export function gainsForDay(
  transactions: { at: string; kind: string; amount: number }[],
  day: string,
) {
  return transactions
    .filter((t) => dayKey(t.at) === day && (t.kind === "mission" || t.kind === "bonus"))
    .reduce((s, t) => s + t.amount, 0);
}

export const MISSION_BADGE: Record<Mission["status"], { label: string; className: string }> = {
  available: {
    label: "Disponible",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  accepted: {
    label: "À récupérer",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  pickup: {
    label: "En pickup",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  loaded: {
    label: "En livraison",
    className: "bg-primary/10 text-primary",
  },
  delivered: {
    label: "Livrée",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-muted text-muted-foreground",
  },
};
