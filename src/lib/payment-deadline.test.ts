import { describe, expect, it } from "vitest";
import { paymentDeadline } from "./payment-deadline";

const at = (s: string) => new Date(s);

describe("délai de paiement", () => {
  it("veille du créneau à l'heure réglée", () => {
    // Commande lundi 10 h pour mardi 7 h : à payer lundi 20 h.
    expect(paymentDeadline(at("2026-10-12T10:00:00Z"), at("2026-10-13T07:00:00Z"), 20)).toEqual(
      at("2026-10-12T20:00:00Z"),
    );
  });
  it("jamais plus de 24 h après la commande", () => {
    // Commande lundi 10 h pour vendredi : à payer mardi 10 h.
    expect(paymentDeadline(at("2026-10-12T10:00:00Z"), at("2026-10-16T07:00:00Z"), 20)).toEqual(
      at("2026-10-13T10:00:00Z"),
    );
  });
  it("au moins une heure pour payer", () => {
    // Heure limite de commande après l'heure de paiement : une heure quand même.
    expect(paymentDeadline(at("2026-10-12T20:30:00Z"), at("2026-10-13T07:00:00Z"), 20)).toEqual(
      at("2026-10-12T21:30:00Z"),
    );
  });
});
