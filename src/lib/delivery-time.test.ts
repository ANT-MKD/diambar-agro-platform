import { describe, expect, it } from "vitest";
import {
  cutoffHint,
  defaultTimeFor,
  deliveryChoice,
  deliveryDays,
  deliveryTimeProblem,
} from "./delivery-time";

const rules = { cutoffHour: 18, deliveryHours: { from: "06:00", to: "20:00" } };

describe("heure de livraison choisie", () => {
  it("jours proposés selon l'heure limite", () => {
    const morning = deliveryDays(new Date(Date.UTC(2026, 9, 20, 10)), 18);
    expect(morning[0]).toMatchObject({ date: "2026-10-21", nextDay: true });
    expect(morning[0].label).toBe("Mercredi 21 oct.");
    const evening = deliveryDays(new Date(Date.UTC(2026, 9, 20, 19)), 18);
    expect(evening[0]).toMatchObject({ date: "2026-10-22", nextDay: false });
    expect(morning.at(-1)?.date).toBe("2026-11-03");
  });

  it("heure par défaut : la réception du restaurant, dans la plage de livraison", () => {
    const day = deliveryDays(new Date(Date.UTC(2026, 9, 20, 10)), 18, {
      Mercredi: { open: true, from: "05:00", to: "11:00" },
    })[0];
    expect(day.reception?.from).toBe("05:00");
    expect(defaultTimeFor(day, rules.deliveryHours)).toBe("06:00");
  });

  it("libellé et contrôle de l'heure choisie", () => {
    const now = new Date(Date.UTC(2026, 9, 20, 10));
    const ok = deliveryChoice("2026-10-21", "09:30");
    expect(ok.label).toBe("Mercredi 21 oct. · 09:30");
    expect(deliveryTimeProblem(new Date(ok.start), now, rules)).toBeNull();
    expect(
      deliveryTimeProblem(new Date(deliveryChoice("2026-10-20", "15:00").start), now, rules),
    ).toMatch(/jour même/);
    expect(
      deliveryTimeProblem(new Date(deliveryChoice("2026-10-21", "21:30").start), now, rules),
    ).toMatch(/entre 06:00 et 20:00/);
    expect(
      deliveryTimeProblem(new Date(deliveryChoice("2026-11-10", "09:00").start), now, rules),
    ).toMatch(/trop lointaine/);
    const late = new Date(Date.UTC(2026, 9, 20, 19));
    expect(deliveryTimeProblem(new Date(ok.start), late, rules)).toMatch(/après-demain/);
    expect(cutoffHint(late, 18)).toMatch(/Passé 18 h/);
  });
});
