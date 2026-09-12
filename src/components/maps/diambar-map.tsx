import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
  }, [map, points]);
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
    const pts: [number, number][] = markers.map((m) => [m.lat, m.lng]);
    if (followPosition) pts.push(followPosition);
    return [...pts, ...routePositions];
  }, [markers, routePositions, followPosition]);

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
        <TileLayer attribution={tile.attribution} url={tile.url} />
        {shouldFitBounds && allPoints.length > 1 && <FitBounds points={allPoints} />}
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
