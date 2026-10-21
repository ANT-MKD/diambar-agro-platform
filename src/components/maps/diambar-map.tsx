import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { getTileLayer } from "./map-tiles";
import { createMarkerIcon, type MarkerColor } from "./create-marker-icon";
import type { TrackingPlace } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";

export interface MapMarkerConfig extends TrackingPlace {
  id: string;
  color?: MarkerColor;
  pulse?: boolean;
  description?: string;
  /** Au-dessus des autres marqueurs (ex. le livreur). */
  zIndexOffset?: number;
}

export interface RouteLayer {
  points: { lat: number; lng: number }[];
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

interface DiambarMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarkerConfig[];
  route?: TrackingPlace[];
  /** Plusieurs tracés (ex. parcouru / restant) */
  routes?: RouteLayer[];
  className?: string;
  minHeight?: number;
  fitBounds?: boolean;
  /** Suivre ce point à chaque mise à jour (style Yango) */
  followPosition?: [number, number] | null;
  /** Points à cadrer (par défaut : tous les marqueurs et tracés). */
  fitTo?: { lat: number; lng: number }[];
  /** Recadrer seulement quand cette clé change (sinon : à chaque changement de points). */
  fitKey?: string | number;
  /** Zoom maximal du cadrage automatique. */
  maxFitZoom?: number;
  /** Cercle d'incertitude autour d'un point (mètres). */
  accuracyCircle?: { lat: number; lng: number; radiusM: number } | null;
}

function FitBounds({
  points,
  fitKey,
  maxZoom,
}: {
  points: [number, number][];
  fitKey?: string | number;
  maxZoom: number;
}) {
  const map = useMap();
  const latest = useRef(points);
  latest.current = points;
  // Avec `fitKey`, le cadrage n'est refait que quand la clé change (pas à
  // chaque nouvelle position), pour ne pas défaire le zoom de l'utilisateur.
  const trigger = fitKey ?? points;
  useEffect(() => {
    const pts = latest.current;
    if (pts.length < 2) return;
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom });
  }, [map, trigger, maxZoom]);
  return null;
}

function MapFollow({
  position,
  enabled,
}: {
  position: [number, number] | null | undefined;
  enabled: boolean;
}) {
  const map = useMap();
  const lat = position?.[0];
  const lng = position?.[1];
  useEffect(() => {
    if (!enabled || lat == null || lng == null) return;
    map.panTo([lat, lng], { animate: true, duration: 0.85 });
  }, [map, lat, lng, enabled]);
  return null;
}

export function DiambarMap({
  center = [14.5, -16.45],
  zoom = 8,
  markers = [],
  route,
  routes,
  className,
  minHeight = 320,
  fitBounds = true,
  followPosition = null,
  fitTo,
  fitKey,
  maxFitZoom = 13,
  accuracyCircle = null,
}: DiambarMapProps) {
  const { resolvedTheme } = useTheme();
  const tile = getTileLayer(resolvedTheme === "light" ? "light" : "dark");

  const routeLayers = useMemo(() => {
    if (routes?.length) return routes;
    if (route?.length) return [{ points: route, color: "#10b981", weight: 4 }];
    return [];
  }, [route, routes]);

  const routePositions = useMemo(
    () => routeLayers.flatMap((r) => r.points.map((p) => [p.lat, p.lng] as [number, number])),
    [routeLayers],
  );

  const allPoints = useMemo(() => {
    if (fitTo?.length) return fitTo.map((p) => [p.lat, p.lng] as [number, number]);
    const pts: [number, number][] = markers.map((m) => [m.lat, m.lng]);
    if (followPosition) pts.push(followPosition);
    return [...pts, ...routePositions];
  }, [fitTo, markers, routePositions, followPosition]);

  const shouldFitBounds = fitBounds && !followPosition;

  return (
    <div
      className={cn("overflow-hidden rounded-2xl border border-border", className)}
      style={{ minHeight }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        style={{ minHeight, height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          key={`${tile.url}|${tile.dimmed}`}
          attribution={tile.attribution}
          url={tile.url}
          className={tile.dimmed ? "map-tiles-dimmed" : undefined}
        />
        {shouldFitBounds && allPoints.length > 1 && (
          <FitBounds points={allPoints} fitKey={fitKey} maxZoom={maxFitZoom} />
        )}
        {accuracyCircle && accuracyCircle.radiusM > 0 && (
          <Circle
            center={[accuracyCircle.lat, accuracyCircle.lng]}
            radius={accuracyCircle.radiusM}
            pathOptions={{ color: "#059669", weight: 1, fillOpacity: 0.12 }}
          />
        )}
        <MapFollow position={followPosition} enabled={!!followPosition} />

        {routeLayers.map((layer, i) => {
          const positions = layer.points.map((p) => [p.lat, p.lng] as [number, number]);
          if (positions.length < 2) return null;
          return (
            <Polyline
              key={i}
              positions={positions}
              pathOptions={{
                color: layer.color ?? "#10b981",
                weight: layer.weight ?? 4,
                opacity: layer.opacity ?? 0.9,
                dashArray: layer.dashed ? "8 10" : undefined,
                lineCap: "round",
              }}
            />
          );
        })}

        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={createMarkerIcon(m.color ?? "emerald", m.pulse)}
            zIndexOffset={m.zIndexOffset ?? 0}
          >
            <Popup>
              <div className="min-w-[120px] text-sm">
                <p className="font-semibold text-gray-900">{m.label}</p>
                {m.description && <p className="mt-1 text-xs text-gray-600">{m.description}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
