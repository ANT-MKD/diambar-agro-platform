import type { TrackingPlace } from "@/lib/tracking/types";
import type { MarkerColor } from "./marker-html";

export interface MapMarkerConfig extends TrackingPlace {
  id: string;
  color?: MarkerColor;
  pulse?: boolean;
  description?: string;
  /** Au-dessus des autres marqueurs (ex. le livreur). */
  zIndexOffset?: number;
  /** Véhicule (livreur) : pastille orientée dans le sens de la marche. */
  vehicle?: { heading: number | null };
}

export interface RouteLayer {
  points: { lat: number; lng: number }[];
  color?: string;
  weight?: number;
  opacity?: number;
  dashed?: boolean;
}

export interface DiambarMapProps {
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

/** Tracés à dessiner : `routes`, sinon l'ancien `route` unique. */
export function routeLayersOf(props: Pick<DiambarMapProps, "route" | "routes">): RouteLayer[] {
  if (props.routes?.length) return props.routes;
  if (props.route?.length) return [{ points: props.route, color: "#10b981", weight: 4 }];
  return [];
}

/** Points à cadrer, en [lat, lng]. */
export function pointsToFit(
  props: Pick<DiambarMapProps, "fitTo" | "markers" | "followPosition">,
  layers: RouteLayer[],
): [number, number][] {
  if (props.fitTo?.length) return props.fitTo.map((p) => [p.lat, p.lng]);
  const pts: [number, number][] = (props.markers ?? []).map((m) => [m.lat, m.lng]);
  if (props.followPosition) pts.push(props.followPosition);
  for (const l of layers) for (const p of l.points) pts.push([p.lat, p.lng]);
  return pts;
}
