import { lazy, Suspense, useState } from "react";
import { DiambarMapLeaflet } from "./diambar-map-leaflet";
import { canUseMapbox } from "./mapbox-config";
import type { DiambarMapProps } from "./map-types";

export type { DiambarMapProps, MapMarkerConfig, RouteLayer } from "./map-types";

// Carte Mapbox quand un jeton est configuré (et WebGL disponible), sinon
// OpenStreetMap. Si Mapbox ne charge pas (réseau, jeton), repli automatique.
const DiambarMapGl = lazy(() => import("./diambar-map-gl"));

export function DiambarMap(props: DiambarMapProps) {
  const [glFailed, setGlFailed] = useState(false);
  const [useGl] = useState(canUseMapbox);
  if (!useGl || glFailed) return <DiambarMapLeaflet {...props} />;
  return (
    <Suspense
      fallback={
        <div
          className="w-full animate-pulse rounded-2xl bg-muted"
          style={{ minHeight: props.minHeight ?? 320 }}
          aria-hidden
        />
      }
    >
      <DiambarMapGl {...props} onFail={() => setGlFailed(true)} />
    </Suspense>
  );
}
