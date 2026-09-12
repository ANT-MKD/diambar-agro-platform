import { useEffect, useState, type ReactNode } from "react";

/**
 * Ne rend `children` qu'après l'hydratation côté client. Nécessaire pour
 * tout composant qui touche `window`/`document` au montage (ex. Leaflet) et
 * qui casserait le rendu SSR de TanStack Start.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : fallback;
}
