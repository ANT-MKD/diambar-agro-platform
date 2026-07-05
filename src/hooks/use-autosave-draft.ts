import { useEffect, useState } from "react";

/**
 * Persistance localStorage d'un brouillon de formulaire.
 * Renvoie [value, setValue, clear].
 */
export function useAutosaveDraft<T>(key: string, initial: T): [T, (v: T) => void, () => void] {
  const storageKey = `draft:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? { ...(initial as object), ...(JSON.parse(raw) as object) } as T : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // quota exceeded — silently ignore
    }
  }, [storageKey, value]);

  const clear = () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
  };

  return [value, setValue, clear];
}