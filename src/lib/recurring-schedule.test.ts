import { describe, expect, it } from "vitest";
import {
  nextDeliveryDate,
  orderRunAt,
  planOccurrence,
  shiftForHoliday,
  type OccurrenceProduct,
} from "./recurring-engine";

const rules = {
  priceIncreaseThresholdPct: 10,
  onPriceIncrease: "ask_confirmation" as const,
  onOutOfStock: "cancel_item" as const,
  maxBudget: 100_000,
  onBudgetExceeded: "ask_confirmation" as const,
  onNonBusinessDay: "day_after" as const,
};
const tomato: OccurrenceProduct = {
  id: "t",
  name: "Tomates",
  price: 1000,
  stock: 50,
  orderable: true,
  category: "Légumes",
};
const onion: OccurrenceProduct = { ...tomato, id: "o", name: "Oignons", price: 500 };

describe("récurrentes : dates de livraison", () => {
  it("calendrier hebdomadaire, toutes les 2 semaines, mensuel, tous les N jours", () => {
    // 2026-10-19 est un lundi.
    const weekly = {
      frequency: "weekly" as const,
      daysOfWeek: [1, 4],
      firstDeliveryOn: "2026-10-19",
    };
    expect(nextDeliveryDate(weekly, "2026-10-20")).toBe("2026-10-22");
    expect(nextDeliveryDate(weekly, "2026-10-01")).toBe("2026-10-19");
    const biweekly = { ...weekly, frequency: "biweekly" as const, daysOfWeek: [1] };
    expect(nextDeliveryDate(biweekly, "2026-10-20")).toBe("2026-11-02");
    const monthly = {
      frequency: "monthly" as const,
      daysOfWeek: [],
      firstDeliveryOn: "2026-10-31",
    };
    expect(nextDeliveryDate(monthly, "2026-11-01")).toBe("2026-11-30");
    const everyN = {
      frequency: "every_n_days" as const,
      intervalDays: 3,
      daysOfWeek: [],
      firstDeliveryOn: "2026-10-19",
    };
    expect(nextDeliveryDate(everyN, "2026-10-20")).toBe("2026-10-22");
  });

  it("jour non ouvré décalé, commande passée la veille", () => {
    expect(shiftForHoliday("2026-10-25", "day_after")).toBe("2026-10-26"); // dimanche → lundi
    expect(shiftForHoliday("2026-10-25", "day_before")).toBe("2026-10-24");
    expect(shiftForHoliday("2026-10-25", "ask_confirmation")).toBe("2026-10-25");
    expect(shiftForHoliday("2026-11-01", "day_after")).toBe("2026-11-02"); // Toussaint (dimanche)
    expect(orderRunAt("2026-10-22", "08:30").toISOString()).toBe("2026-10-21T08:30:00.000Z");
  });
});

describe("récurrentes : règles d'une échéance", () => {
  const items = [
    { productId: "t", qty: 10, referencePrice: 1000 },
    { productId: "o", qty: 10, referencePrice: 500 },
  ];
  const plan = (over: Partial<Parameters<typeof planOccurrence>[0]> = {}) =>
    planOccurrence({
      items,
      rules,
      occurrenceDate: "2026-10-22",
      products: [tomato, onion],
      deliveryFee: 1500,
      ...over,
    });

  it("commande normale", () => {
    expect(plan()).toMatchObject({ kind: "order", items });
  });

  it("rupture : ligne retirée, ou décision demandée", () => {
    const out = plan({ products: [tomato, { ...onion, stock: 0 }] });
    expect(out).toMatchObject({ kind: "order", items: [items[0]] });
    const ask = plan({
      products: [tomato, { ...onion, stock: 0 }],
      rules: { ...rules, onOutOfStock: "ask_confirmation" },
    });
    expect(ask).toMatchObject({ kind: "pending", pending: { kind: "out_of_stock" } });
    const replaced = plan({
      products: [
        tomato,
        { ...onion, stock: 0 },
        { ...onion, id: "o2", name: "Oignons rouges", price: 550 },
      ],
      rules: { ...rules, onOutOfStock: "replace_equivalent" },
    });
    expect(replaced.kind === "order" && replaced.items.map((i) => i.productId)).toEqual([
      "t",
      "o2",
    ]);
  });

  it("hausse de prix et budget", () => {
    expect(plan({ products: [{ ...tomato, price: 1200 }, onion] })).toMatchObject({
      kind: "pending",
      pending: { kind: "price_increase" },
    });
    expect(
      plan({ products: [{ ...tomato, price: 1200 }, onion], bypass: "price_increase" }).kind,
    ).toBe("order");
    expect(
      plan({
        rules: { ...rules, onPriceIncrease: "suspend" },
        products: [{ ...tomato, price: 1200 }, onion],
      }).kind,
    ).toBe("pause");
    const reduced = plan({
      rules: { ...rules, maxBudget: 9000, onBudgetExceeded: "reduce_quantities" },
    });
    expect(reduced.kind).toBe("order");
    const total =
      reduced.kind === "order"
        ? reduced.items.reduce((s, i) => s + i.qty * (i.productId === "t" ? 1000 : 500), 0)
        : 0;
    expect(total + 1500).toBeLessThanOrEqual(9000);
    expect(plan({ rules: { ...rules, maxBudget: 9000, onBudgetExceeded: "cancel" } }).kind).toBe(
      "skip",
    );
  });
});
