import { describe, expect, it } from "vitest";
import { deliverySlots } from "./reception-slots";
import type { ReceptionDay, ReceptionSlot } from "@/data/mocks";

const DAYS: ReceptionDay[] = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
const hours = Object.fromEntries(
  DAYS.map((d) => [d, { open: d !== "Dimanche", from: "07:00", to: "11:00" }]),
) as Record<ReceptionDay, ReceptionSlot>;

describe("créneaux de livraison", () => {
  it("propose le lendemain avant 18 h, jamais le jour même", () => {
    // Mardi 29 septembre 2026, 10 h
    const slots = deliverySlots(hours, { now: new Date(2026, 8, 29, 10) });
    expect(slots[0].label.startsWith("Mercredi 30")).toBe(true);
    expect(slots[0].nextDay).toBe(true);
  });
  it("après 18 h, commence au surlendemain", () => {
    const slots = deliverySlots(hours, { now: new Date(2026, 8, 29, 19) });
    expect(slots[0].label.startsWith("Jeudi 1")).toBe(true);
    expect(slots[0].nextDay).toBe(false);
  });
  it("saute les jours fermés", () => {
    // Samedi 3 octobre 2026, 9 h → dimanche fermé → lundi
    const slots = deliverySlots(hours, { now: new Date(2026, 9, 3, 9) });
    expect(slots[0].label.startsWith("Lundi 5")).toBe(true);
  });
});
