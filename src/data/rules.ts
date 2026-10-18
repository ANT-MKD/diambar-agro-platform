import { useSyncExternalStore } from "react";
import { createStore } from "./persist";
import { DEFAULT_RULES, type PlatformRules } from "@/lib/platform-rules";
import type { PaymentMethod } from "./mocks";

// Règles de la plateforme vues par les écrans : celles de la base en mode
// serveur (heure limite, minimum, délais, retraits, heures de livraison,
// paie des livreurs, villes et moyens de paiement ouverts), sinon celles de
// la démonstration.

export type ClientRules = PlatformRules & {
  cities: string[];
  paymentMethods: PaymentMethod[];
};

const rulesStore = createStore<ClientRules>({
  ...DEFAULT_RULES,
  cities: ["Dakar", "Thiès", "Mbour"],
  paymentMethods: ["Wave", "Orange Money", "Espèces"],
});

export function useRules(): ClientRules {
  return useSyncExternalStore(rulesStore.subscribe, rulesStore.get, rulesStore.get);
}

export function getRules(): ClientRules {
  return rulesStore.get();
}

export function replaceRules(rules: ClientRules) {
  rulesStore.replace(rules);
}
