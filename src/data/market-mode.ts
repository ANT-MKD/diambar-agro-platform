import { useSyncExternalStore } from "react";
import type { Role } from "./mocks";

// Mode des données de la place de marché, côté navigateur :
// - « local » (démonstration sans base) : produits, commandes et missions
//   vivent dans le navigateur, comme avant ;
// - « serveur » (base de données) : ils viennent du serveur, pour le compte
//   connecté, et chaque action passe par le serveur.
// Module sans dépendance : lu par les magasins de données et par les écrans.

export type MarketMode = {
  remote: boolean;
  me: { id: string; role: Role } | null;
};

let state: MarketMode = { remote: false, me: null };
const listeners = new Set<() => void>();

export function getMarketMode(): MarketMode {
  return state;
}

export function setMarketMode(next: MarketMode) {
  state = next;
  listeners.forEach((l) => l());
}

export function isMarketRemote(): boolean {
  return state.remote;
}

export function useMarketMode(): MarketMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

// Identifiants du compte de démonstration dans les données locales.
const DEMO_IDS: Record<Exclude<Role, "admin">, string> = {
  farmer: "f1",
  restaurant: "r1",
  driver: "d1",
};

/** Identifiant du compte connecté dans les données affichées : le vrai
 * compte en mode serveur, le compte de démonstration sinon. */
export function myId(role: Exclude<Role, "admin">): string {
  return state.remote && state.me?.role === role ? state.me.id : DEMO_IDS[role];
}

export function useMyId(role: Exclude<Role, "admin">): string {
  const mode = useMarketMode();
  return mode.remote && mode.me?.role === role ? mode.me.id : DEMO_IDS[role];
}
