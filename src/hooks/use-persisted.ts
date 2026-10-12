import { useEffect, useState } from "react";

/**
 * Le SSR n'a pas accès à localStorage, donc l'état initial doit rester identique
 * entre serveur et client (sinon React ne corrige pas le mismatch d'hydratation
 * sur les attributs comme aria-pressed/className, et l'UI reste figée sur la
 * valeur par défaut). La valeur persistée est donc appliquée après coup, dans un
 * effet qui ne s'exécute que côté client une fois l'hydratation terminée.
 */
export function usePersisted<T>(
  key: string | undefined,
  initial: T | (() => T),
): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() =>
    typeof initial === "function" ? (initial as () => T)() : initial,
  );

  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        setState((prev) => ({ ...(prev as object), ...(JSON.parse(raw) as object) }) as T);
      }
    } catch {
      /* ignore */
    }
  }, [key]);

  const update = (v: T) => {
    setState(v);
    if (!key || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };

  return [state, update];
}
