// Stockage local partagé par tous les magasins de données (Phase 0, avant la
// base de données).
//
// Deux protections contre les données enregistrées par une ancienne version
// de l'application, qui faisaient planter des pages entières (paiement,
// paramètres, facture) quand un champ ajouté depuis manquait :
//   1. une version de schéma : quand elle change, toutes les données
//      « diambar:* » enregistrées sont effacées et les données de démo
//      reprennent leur place ;
//   2. un objet enregistré est fusionné avec sa valeur initiale, pour que les
//      champs ajoutés plus tard aient toujours une valeur.

// À incrémenter à chaque changement de forme des données enregistrées.
export const DATA_VERSION = 3;
const VERSION_KEY = "diambar-data-version";
const DATA_PREFIX = "diambar:";

let versionChecked = false;

export function ensureDataVersion() {
  if (versionChecked || typeof window === "undefined") return;
  versionChecked = true;
  try {
    const ls = window.localStorage;
    if (ls.getItem(VERSION_KEY) === String(DATA_VERSION)) return;
    const stale: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(DATA_PREFIX)) stale.push(k);
    }
    stale.forEach((k) => ls.removeItem(k));
    ls.setItem(VERSION_KEY, String(DATA_VERSION));
  } catch {
    /* stockage indisponible : on garde les valeurs initiales */
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Lit une valeur enregistrée ; un objet est complété par sa valeur initiale. */
export function readPersisted<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;
  ensureDataVersion();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as unknown;
    if (isPlainObject(initial)) {
      return isPlainObject(parsed) ? ({ ...initial, ...parsed } as T) : initial;
    }
    if (Array.isArray(initial) && !Array.isArray(parsed)) return initial;
    return parsed as T;
  } catch {
    return initial;
  }
}

export function writePersisted(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type Listener = () => void;

export function createStore<T>(initial: T, persistKey?: string) {
  let key = persistKey;
  let state = key ? readPersisted(key, initial) : initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (key) writePersisted(key, state);
      listeners.forEach((l) => l());
    },
    /** Données venues du serveur (mode base de données) : elles remplacent
     * l'état et ne sont plus gardées dans le navigateur (les données de
     * démonstration enregistrées sont effacées). */
    replace: (next: T) => {
      if (key && typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(key);
        } catch {
          /* stockage indisponible */
        }
      }
      key = undefined;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
