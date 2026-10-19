import { describe, expect, it } from "vitest";
import {
  categoryKey,
  categoryNameProblem,
  cleanCategoryName,
  sameCategory,
  similarCategories,
} from "./category-name";

const list = ["Légumes", "Fruits", "Viande", "Volaille", "Céréales", "Tubercules", "Épices"].map(
  (name) => ({ name }),
);

describe("noms de catégories", () => {
  it("même catégorie malgré la casse, les accents et le pluriel", () => {
    expect(categoryKey("LÉGUMES")).toBe(categoryKey("legume"));
    expect(sameCategory("legume", list)?.name).toBe("Légumes");
    expect(sameCategory(" épices ", list)?.name).toBe("Épices");
    expect(sameCategory("Champignons", list)).toBeNull();
  });

  it("nom nettoyé et validé", () => {
    expect(cleanCategoryName("  produits   laitiers ")).toBe("Produits laitiers");
    expect(categoryNameProblem("ab")).toMatch(/trop court/);
    expect(categoryNameProblem("x".repeat(41))).toMatch(/trop long/);
    expect(categoryNameProblem("<script>")).toMatch(/lettres/);
    expect(categoryNameProblem("Fruits de mer")).toBeNull();
  });

  it("suggestions avant de créer une catégorie", () => {
    expect(similarCategories("Legumes frais", list).map((c) => c.name)).toEqual(["Légumes"]);
    expect(similarCategories("Volailes", list).map((c) => c.name)).toEqual(["Volaille"]);
    expect(similarCategories("Champignons", list)).toEqual([]);
    // Import : seules les fautes de frappe bloquent.
    expect(similarCategories("Fruits de mer", list, 1, { typosOnly: true })).toEqual([]);
    expect(similarCategories("Volailes", list, 1, { typosOnly: true }).map((c) => c.name)).toEqual([
      "Volaille",
    ]);
  });
});
