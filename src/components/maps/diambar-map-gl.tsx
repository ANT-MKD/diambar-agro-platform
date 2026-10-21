import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { isStandardStyle, MAPBOX_STYLE, MAPBOX_TOKEN } from "./mapbox-config";
import { pinHtml, vehicleHtml } from "./marker-html";
import {
  pointsToFit,
  routeLayersOf,
  type DiambarMapProps,
  type MapMarkerConfig,
} from "./map-types";
import { cn } from "@/lib/utils";

// Carte Mapbox (vectorielle) : même interface que la carte Leaflet.
// `onFail` : jeton refusé, style introuvable ou chargement trop long ; la
// carte OpenStreetMap prend alors le relais.

/** Au-delà, Mapbox est jugé indisponible (réseau, jeton) : repli OpenStreetMap. */
const LOAD_TIMEOUT_MS = 12_000;
/** Durée du glissement du livreur d'une position à la suivante. */
const MOVE_MS = 1_200;

type Placed = {
  marker: mapboxgl.Marker;
  key: string;
  lng: number;
  lat: number;
  anim?: number;
};

function popupContent(m: MapMarkerConfig): HTMLElement {
  // Textes venant de la base : insérés comme texte, jamais comme HTML.
  const root = document.createElement("div");
  root.className = "min-w-[120px] text-sm";
  const title = document.createElement("p");
  title.className = "font-semibold text-gray-900";
  title.textContent = m.label;
  root.append(title);
  if (m.description) {
    const d = document.createElement("p");
    d.className = "mt-1 text-xs text-gray-600";
    d.textContent = m.description;
    root.append(d);
  }
  return root;
}

function markerElement(m: MapMarkerConfig): HTMLElement {
  const el = document.createElement("div");
  // Le HTML vient de nos propres gabarits (couleurs fixes), pas des données.
  el.innerHTML = m.vehicle
    ? vehicleHtml(m.color ?? "emerald", true, m.vehicle.heading != null)
    : `<div class="diambar-marker-gl">${pinHtml(m.color ?? "emerald", m.pulse)}</div>`;
  return el;
}

/** Ce qui change l'apparence du marqueur (sinon, seule la position bouge). */
const appearanceKey = (m: MapMarkerConfig) =>
  [m.color, m.pulse, !!m.vehicle, m.vehicle?.heading != null, m.label, m.description].join("|");

/** Cercle (polygone) de `radiusM` mètres autour d'un point. */
function circlePolygon(lat: number, lng: number, radiusM: number): GeoJSON.Feature {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

const lineFeature = (points: { lat: number; lng: number }[]): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: points.map((p) => [p.lng, p.lat]) },
});

export default function DiambarMapGl({
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
  onFail,
}: DiambarMapProps & { onFail: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const placed = useRef(new Map<string, Placed>());
  const routeCount = useRef(0);
  const [ready, setReady] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const standard = isStandardStyle(MAPBOX_STYLE);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  // Création de la carte (une fois).
  useEffect(() => {
    if (!container.current) return;
    let loaded = false;
    const map = new mapboxgl.Map({
      container: container.current,
      accessToken: MAPBOX_TOKEN,
      style: MAPBOX_STYLE,
      ...(standard ? { config: { basemap: { lightPreset: dark ? "night" : "day" } } } : {}),
      center: [center[1], center[0]],
      zoom,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");
    const timer = window.setTimeout(() => {
      if (!loaded) failRef.current();
    }, LOAD_TIMEOUT_MS);
    map.on("load", () => {
      loaded = true;
      window.clearTimeout(timer);
      setReady(true);
    });
    map.on("error", (e) => {
      // Jeton refusé, ou style introuvable avant le chargement → repli.
      // Une tuile manquante (erreur liée à une source) ne suffit pas.
      const status = (e.error as { status?: number } | undefined)?.status;
      const tileError = "sourceId" in e && !!(e as { sourceId?: string }).sourceId;
      if (status === 401 || status === 403 || (!loaded && !tileError)) failRef.current();
    });
    const markersMap = placed.current;
    return () => {
      window.clearTimeout(timer);
      for (const p of markersMap.values()) {
        if (p.anim) cancelAnimationFrame(p.anim);
        p.marker.remove();
      }
      markersMap.clear();
      map.remove();
      mapRef.current = null;
    };
    // Le centre et le zoom de départ ne servent qu'à la création.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thème : jour / nuit sans recharger la carte.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !standard) return;
    map.setConfigProperty("basemap", "lightPreset", dark ? "night" : "day");
  }, [dark, ready, standard]);

  // Tracés.
  const layers = useMemo(() => routeLayersOf({ route, routes }), [route, routes]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    layers.forEach((l, i) => {
      const id = `diambar-route-${i}`;
      const data = lineFeature(l.points);
      const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(id, { type: "geojson", data });
      if (map.getLayer(id)) map.removeLayer(id);
      map.addLayer({
        id,
        type: "line",
        source: id,
        ...(standard ? { slot: "middle" } : {}),
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": l.color ?? "#10b981",
          "line-width": l.weight ?? 4,
          "line-opacity": l.opacity ?? 0.9,
          ...(l.dashed ? { "line-dasharray": [1.5, 2] } : {}),
        },
      });
    });
    for (let i = layers.length; i < routeCount.current; i++) {
      const id = `diambar-route-${i}`;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    routeCount.current = layers.length;
  }, [layers, ready, standard]);

  // Cercle d'incertitude du GPS.
  const circle = accuracyCircle && accuracyCircle.radiusM > 0 ? accuracyCircle : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const id = "diambar-accuracy";
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: circle ? [circlePolygon(circle.lat, circle.lng, circle.radiusM)] : [],
    };
    const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(id, { type: "geojson", data });
    map.addLayer({
      id,
      type: "fill",
      source: id,
      ...(standard ? { slot: "middle" } : {}),
      paint: { "fill-color": "#059669", "fill-opacity": 0.12, "fill-outline-color": "#059669" },
    });
  }, [circle?.lat, circle?.lng, circle?.radiusM, ready, standard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marqueurs : créés une fois, puis déplacés (le livreur glisse en douceur).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const key = appearanceKey(m);
      let p = placed.current.get(m.id);
      if (p && p.key !== key) {
        p.marker.remove();
        placed.current.delete(m.id);
        p = undefined;
      }
      if (!p) {
        const marker = new mapboxgl.Marker({
          element: markerElement(m),
          anchor: m.vehicle ? "center" : "bottom",
          ...(m.vehicle ? { rotationAlignment: "map" as const } : {}),
        })
          .setLngLat([m.lng, m.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 22, closeButton: false }).setDOMContent(popupContent(m)),
          )
          .addTo(map);
        if (m.zIndexOffset) marker.getElement().style.zIndex = String(10 + m.zIndexOffset);
        p = { marker, key, lng: m.lng, lat: m.lat };
        placed.current.set(m.id, p);
      } else if (p.lng !== m.lng || p.lat !== m.lat) {
        const from = p.marker.getLngLat();
        const to = { lng: m.lng, lat: m.lat };
        if (p.anim) cancelAnimationFrame(p.anim);
        if (m.vehicle) {
          const start = performance.now();
          const target = p;
          const step = (t: number) => {
            const k = Math.min(1, (t - start) / MOVE_MS);
            const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
            target.marker.setLngLat([
              from.lng + (to.lng - from.lng) * e,
              from.lat + (to.lat - from.lat) * e,
            ]);
            target.anim = k < 1 ? requestAnimationFrame(step) : undefined;
          };
          p.anim = requestAnimationFrame(step);
        } else {
          p.marker.setLngLat([to.lng, to.lat]);
        }
        p.lng = m.lng;
        p.lat = m.lat;
      }
      if (m.vehicle?.heading != null) p.marker.setRotation(m.vehicle.heading);
    }
    for (const [id, p] of placed.current) {
      if (seen.has(id)) continue;
      if (p.anim) cancelAnimationFrame(p.anim);
      p.marker.remove();
      placed.current.delete(id);
    }
  }, [markers]);

  // Cadrage : comme la carte Leaflet (une seule fois par `fitKey`).
  const fitPoints = useMemo(
    () => pointsToFit({ fitTo, markers, followPosition }, layers),
    [fitTo, markers, followPosition, layers],
  );
  const latestFit = useRef(fitPoints);
  latestFit.current = fitPoints;
  const shouldFit = fitBounds && !followPosition;
  const trigger = fitKey ?? fitPoints;
  const firstFit = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !shouldFit) return;
    const pts = latestFit.current;
    if (pts.length < 2) return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const [lat, lng] of pts) bounds.extend([lng, lat]);
    map.fitBounds(bounds, {
      padding: 48,
      maxZoom: maxFitZoom,
      duration: firstFit.current ? 0 : 600,
    });
    firstFit.current = false;
  }, [trigger, shouldFit, maxFitZoom]);

  // Suivi du livreur.
  const fLat = followPosition?.[0];
  const fLng = followPosition?.[1];
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fLat == null || fLng == null) return;
    map.easeTo({ center: [fLng, fLat], duration: 850 });
  }, [fLat, fLng]);

  return (
    <div
      ref={container}
      className={cn("overflow-hidden rounded-2xl border border-border", className)}
      style={{ minHeight, height: minHeight }}
    />
  );
}
