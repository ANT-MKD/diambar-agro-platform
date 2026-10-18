import type { ReceptionDay, ReceptionSlot } from "@/data/mocks";
import { minutesOf, type DeliveryHours } from "@/lib/platform-rules";

// Heure de livraison choisie par le restaurant : un jour (jamais le jour
// même ; après l'heure limite, pas avant le surlendemain ; 14 jours au plus)
// et l'heure exacte souhaitée, dans les heures de livraison de la plateforme.
// Mêmes règles dans le navigateur et sur le serveur. Dakar est à l'heure UTC
// toute l'année : les calculs se font en UTC.

const DAY_MS = 24 * 3600_000;
export const MAX_DAYS_AHEAD = 14;

const DAY_NAMES: ReceptionDay[] = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

const startOfDayUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Premier jour livrable (minuit UTC) selon l'heure limite. */
export function firstDeliveryDay(now: Date, cutoffHour: number): number {
  return startOfDayUtc(now) + (now.getUTCHours() < cutoffHour ? 1 : 2) * DAY_MS;
}

export type DeliveryDay = {
  /** AAAA-MM-JJ */
  date: string;
  /** « Mardi 21 oct. » */
  label: string;
  /** Demain : la course est prioritaire. */
  nextDay: boolean;
  /** Horaires de réception habituels du restaurant ce jour-là (null : fermé). */
  reception: ReceptionSlot | null;
};

export function dayLabel(dateMs: number): string {
  const d = new Date(dateMs);
  const name = DAY_NAMES[d.getUTCDay()];
  const short = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${name} ${short}`;
}

/** Jours que le restaurant peut choisir, du premier livrable à 14 jours. */
export function deliveryDays(
  now: Date,
  cutoffHour: number,
  receptionHours?: Partial<Record<ReceptionDay, ReceptionSlot>>,
): DeliveryDay[] {
  const today = startOfDayUtc(now);
  const first = firstDeliveryDay(now, cutoffHour);
  const days: DeliveryDay[] = [];
  for (let t = first; t <= today + MAX_DAYS_AHEAD * DAY_MS; t += DAY_MS) {
    const slot = receptionHours?.[DAY_NAMES[new Date(t).getUTCDay()]];
    days.push({
      date: new Date(t).toISOString().slice(0, 10),
      label: dayLabel(t),
      nextDay: t - today === DAY_MS,
      reception: slot?.open ? slot : null,
    });
  }
  return days;
}

/** Heure ramenée dans les heures de livraison (« 05:00 » → « 06:00 »). */
export function clampTime(time: string, hours: DeliveryHours): string {
  const m = Math.min(Math.max(minutesOf(time), minutesOf(hours.from)), minutesOf(hours.to));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Heure proposée par défaut : le début de la réception du restaurant, ramené
 * dans les heures de livraison. */
export function defaultTimeFor(day: DeliveryDay | undefined, hours: DeliveryHours): string {
  return clampTime(day?.reception?.from ?? hours.from, hours);
}

/** Livraison choisie : début (ISO) et libellé (« Mardi 21 oct. · 09:30 »). */
export function deliveryChoice(date: string, time: string): { start: string; label: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const t = Date.UTC(y, (mo || 1) - 1, d || 1, h || 0, mi || 0);
  return { start: new Date(t).toISOString(), label: `${dayLabel(t)} · ${time}` };
}

/** Problème de l'heure de livraison choisie, ou null si elle est valable. */
export function deliveryTimeProblem(
  start: Date,
  now: Date,
  rules: { cutoffHour: number; deliveryHours: DeliveryHours },
): string | null {
  if (Number.isNaN(start.getTime())) return "Heure de livraison invalide.";
  const today = startOfDayUtc(now);
  if (start.getTime() < firstDeliveryDay(now, rules.cutoffHour)) {
    return now.getUTCHours() < rules.cutoffHour
      ? "La livraison le jour même n'est pas possible : choisissez demain ou plus tard."
      : `Passé ${rules.cutoffHour} h, la première livraison possible est après-demain : choisissez un autre jour.`;
  }
  if (start.getTime() >= today + (MAX_DAYS_AHEAD + 1) * DAY_MS) {
    return `Livraison trop lointaine (${MAX_DAYS_AHEAD} jours au plus).`;
  }
  const minutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  const { from, to } = rules.deliveryHours;
  if (minutes < minutesOf(from) || minutes > minutesOf(to)) {
    return `Les livraisons se font entre ${from} et ${to} : choisissez une heure dans cette plage.`;
  }
  return null;
}

/** Message sur l'heure limite, affiché au moment de commander. */
export function cutoffHint(now: Date, cutoffHour: number): string {
  return now.getUTCHours() < cutoffHour
    ? `Commandez avant ${cutoffHour} h pour être livré demain.`
    : `Passé ${cutoffHour} h : première livraison possible après-demain.`;
}
