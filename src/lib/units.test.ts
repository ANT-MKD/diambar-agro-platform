import { describe, expect, it } from "vitest";
import { canonicalUnit, cleanUnit, unitChoices, unitProblem } from "./units";

describe("unités de vente", () => {
  it("une unité écrite autrement reprend l'existante", () => {
    expect(canonicalUnit("Sacs", ["kg", "sac"])).toBe("sac");
    expect(canonicalUnit(" Unités ", ["kg", "unité"])).toBe("unité");
    expect(canonicalUnit("Seau  10 L", ["kg"])).toBe("seau 10 l");
    expect(cleanUnit("  Cagette ")).toBe("cagette");
  });

  it("liste proposée sans doublon", () => {
    const list = unitChoices(["Sacs", "seau"]);
    expect(list.slice(0, 5)).toEqual(["kg", "litre", "unité", "botte", "sac"]);
    expect(list).toContain("seau");
    expect(list.filter((u) => u.startsWith("sac"))).toEqual(["sac"]);
  });

  it("unités refusées", () => {
    expect(unitProblem("")).toMatch(/Indiquez/);
    expect(unitProblem("x".repeat(21))).toMatch(/trop longue/);
    expect(unitProblem("<b>")).toMatch(/lettres/);
    expect(unitProblem("tas de 5")).toBeNull();
  });
});
