import { addDaysIso, nextDeliveryDate } from "@/lib/recurring-engine";
import type { RecurringOrder } from "@/data/mocks";

/** « mercredi 21 octobre · 09:30 » : prochaine livraison (mode base), ou à
 * défaut la prochaine commande prévue (démonstration). */
export function nextDeliveryLabel(
  r: Pick<RecurringOrder, "nextDeliveryOn" | "nextRunAt" | "deliverySlot">,
): string {
  if (r.nextDeliveryOn) {
    const day = new Date(`${r.nextDeliveryOn}T00:00:00Z`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
    return `${day} · ${r.deliverySlot}`;
  }
  if (!r.nextRunAt) return "—";
  return new Date(r.nextRunAt).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Mode base : les prochaines livraisons (date et heure), calculées comme
 * sur le serveur ; null en démonstration. */
export function upcomingDeliveries(r: RecurringOrder, count: number): Date[] | null {
  if (!r.nextDeliveryOn) return null;
  const schedule = {
    frequency: r.frequency,
    intervalDays: r.intervalDays,
    daysOfWeek: r.daysOfWeek,
    firstDeliveryOn: r.firstRunAt.slice(0, 10),
  };
  const out: Date[] = [];
  let day: string | null = r.nextDeliveryOn;
  while (day && out.length < count) {
    out.push(
      new Date(`${day}T${/^\d{2}:\d{2}$/.test(r.deliverySlot) ? r.deliverySlot : "09:00"}:00Z`),
    );
    day = nextDeliveryDate(schedule, addDaysIso(day, 1));
  }
  return out;
}
