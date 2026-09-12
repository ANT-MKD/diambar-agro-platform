import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Wrapper léger autour de useSearch/useNavigate pour manipuler
 * les filtres/tri/pagination via l'URL de manière typée.
 */
export function useUrlFilters<T extends Record<string, unknown>>() {
  const search = useSearch({ strict: false } as never) as T;
  const navigate = useNavigate();

  const set = useCallback(
    (patch: Partial<T>) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as never,
        replace: true,
      });
    },
    [navigate],
  );

  const reset = useCallback(() => {
    navigate({ to: ".", search: {} as never, replace: true });
  }, [navigate]);

  return { search, set, reset };
}
