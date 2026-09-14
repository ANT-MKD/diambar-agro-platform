import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/common/client-only";
import type { MapMarkerConfig } from "./diambar-map";

// Leaflet touche `window`/`document` : import différé + rendu client-only
// uniquement, sinon le SSR de TanStack Start plante.
const DiambarMap = lazy(() => import("./diambar-map").then((m) => ({ default: m.DiambarMap })));

function MapFallback({ minHeight = 320 }: { minHeight?: number }) {
  return (
    <div className="w-full animate-pulse rounded-2xl bg-muted" style={{ minHeight }} aria-hidden />
  );
}

export function DiambarMapLazy(props: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarkerConfig[];
  className?: string;
  minHeight?: number;
  fitBounds?: boolean;
}) {
  return (
    <ClientOnly fallback={<MapFallback minHeight={props.minHeight} />}>
      <Suspense fallback={<MapFallback minHeight={props.minHeight} />}>
        <DiambarMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
