import { beforeEach, describe, expect, it, vi } from "vitest";

// Chaque test recharge le module pour repartir d'une vérification de version
// neuve (elle n'a lieu qu'une fois par chargement).
async function freshPersist() {
  vi.resetModules();
  return import("./persist");
}

describe("données enregistrées", () => {
  beforeEach(() => window.localStorage.clear());

  it("complète un objet enregistré par une ancienne version", async () => {
    const { DATA_VERSION, readPersisted } = await freshPersist();
    window.localStorage.setItem("diambar-data-version", String(DATA_VERSION));
    window.localStorage.setItem("diambar:profil", JSON.stringify({ adresse: "Plateau" }));
    const v = readPersisted("diambar:profil", { adresse: "", horaires: { Lundi: "07:00" } });
    expect(v).toEqual({ adresse: "Plateau", horaires: { Lundi: "07:00" } });
  });

  it("efface les données d'une autre version de schéma", async () => {
    const { DATA_VERSION, readPersisted } = await freshPersist();
    window.localStorage.setItem("diambar-data-version", "0");
    window.localStorage.setItem("diambar:liste", JSON.stringify([1, 2, 3]));
    window.localStorage.setItem("diambar-cookie-consent", "ok");
    expect(readPersisted("diambar:liste", [9])).toEqual([9]);
    expect(window.localStorage.getItem("diambar-data-version")).toBe(String(DATA_VERSION));
    // Le consentement cookies n'est pas une donnée métier : conservé.
    expect(window.localStorage.getItem("diambar-cookie-consent")).toBe("ok");
  });

  it("ignore une valeur de mauvaise forme", async () => {
    const { DATA_VERSION, readPersisted } = await freshPersist();
    window.localStorage.setItem("diambar-data-version", String(DATA_VERSION));
    window.localStorage.setItem("diambar:liste", JSON.stringify({ pas: "une liste" }));
    window.localStorage.setItem("diambar:obj", "not json");
    expect(readPersisted("diambar:liste", [1])).toEqual([1]);
    expect(readPersisted("diambar:obj", { a: 1 })).toEqual({ a: 1 });
  });
});
