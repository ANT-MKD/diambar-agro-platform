import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/common/client-only";
import type { LiveTrackingMapProps } from "./live-tracking-map";

// Leaflet touche `window`/`document` : import différé + rendu client-only
// uniquement, sinon le SSR de TanStack Start plante.
const LiveTrackingMap = lazy(() =>
  import("./live-tracking-map").then((m) => ({ default: m.LiveTrackingMap })),
);

function MapFallback({ minHeight = 420 }: { minHeight?: number }) {
  return (
    <div className="w-full animate-pulse rounded-2xl bg-muted" style={{ minHeight }} aria-hidden />
  );
}

export function LiveTrackingMapLazy(props: LiveTrackingMapProps) {
  return (
    <ClientOnly fallback={<MapFallback minHeight={props.minHeight} />}>
      <Suspense fallback={<MapFallback minHeight={props.minHeight} />}>
        <LiveTrackingMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
