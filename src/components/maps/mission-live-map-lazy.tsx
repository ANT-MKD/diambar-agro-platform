import { lazy, Suspense } from "react";
import { ClientOnly } from "@/components/common/client-only";
import type { FleetLiveMapProps, MissionLiveMapProps } from "./mission-live-map";

// Leaflet touche `window`/`document` : import différé, rendu côté client seulement.
const MissionLiveMap = lazy(() =>
  import("./mission-live-map").then((m) => ({ default: m.MissionLiveMap })),
);

const FleetLiveMap = lazy(() =>
  import("./mission-live-map").then((m) => ({ default: m.FleetLiveMap })),
);

function MapFallback({ minHeight = 360 }: { minHeight?: number }) {
  return (
    <div className="w-full animate-pulse rounded-2xl bg-muted" style={{ minHeight }} aria-hidden />
  );
}

export function MissionLiveMapLazy(props: MissionLiveMapProps) {
  return (
    <ClientOnly fallback={<MapFallback minHeight={props.minHeight} />}>
      <Suspense fallback={<MapFallback minHeight={props.minHeight} />}>
        <MissionLiveMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}

export function FleetLiveMapLazy(props: FleetLiveMapProps) {
  return (
    <ClientOnly fallback={<MapFallback minHeight={props.minHeight} />}>
      <Suspense fallback={<MapFallback minHeight={props.minHeight} />}>
        <FleetLiveMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
