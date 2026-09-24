import { describe, expect, it } from "vitest";
import {
  AttemptLimiter,
  formatSenegalPhone,
  generateSixDigitCode,
  normalizeEmail,
  normalizeSenegalPhone,
  safeEqual,
} from "./helpers";

describe("normalisation des identifiants", () => {
  it("compare les emails sans majuscules ni espaces", () => {
    expect(normalizeEmail("  Awa.Camara@Gmail.COM ")).toBe("awa.camara@gmail.com");
  });

  it("ramène un numéro sénégalais à 9 chiffres, quelle que soit la saisie", () => {
    expect(normalizeSenegalPhone("77 123 45 67")).toBe("771234567");
    expect(normalizeSenegalPhone("+221 77 123 45 67")).toBe("771234567");
    expect(normalizeSenegalPhone("00221771234567")).toBe("771234567");
    expect(normalizeSenegalPhone("221771234567")).toBe("771234567");
    expect(normalizeSenegalPhone("7712345")).toBeNull();
    expect(normalizeSenegalPhone("77 123 45 67 89")).toBeNull();
  });

  it("formate un numéro pour l'affichage", () => {
    expect(formatSenegalPhone("771234567")).toBe("77 123 45 67");
  });
});

describe("codes de vérification", () => {
  it("génère toujours 6 chiffres", () => {
    for (let i = 0; i < 200; i++) expect(generateSixDigitCode()).toMatch(/^\d{6}$/);
  });

  it("compare deux codes sans raccourci", () => {
    expect(safeEqual("123456", "123456")).toBe(true);
    expect(safeEqual("123456", "123457")).toBe(false);
    expect(safeEqual("12345", "123456")).toBe(false);
  });
});

describe("limiteur de tentatives", () => {
  it("bloque après le nombre d'échecs permis, puis libère après la fenêtre", () => {
    const limiter = new AttemptLimiter(3, 15 * 60_000);
    const t0 = 1_000_000;
    limiter.fail("a", t0);
    limiter.fail("a", t0 + 1000);
    expect(limiter.lockedMinutes("a", t0 + 2000)).toBe(0);
    expect(limiter.remaining("a", t0 + 2000)).toBe(1);
    limiter.fail("a", t0 + 2000);
    expect(limiter.lockedMinutes("a", t0 + 3000)).toBe(15);
    expect(limiter.lockedMinutes("b", t0 + 3000)).toBe(0);
    expect(limiter.lockedMinutes("a", t0 + 15 * 60_000 + 1000)).toBe(0);
  });

  it("repart de zéro après une réussite", () => {
    const limiter = new AttemptLimiter(2, 60_000);
    limiter.fail("a", 0);
    limiter.fail("a", 1);
    limiter.reset("a");
    expect(limiter.lockedMinutes("a", 2)).toBe(0);
  });
});
