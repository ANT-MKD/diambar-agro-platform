import L from "leaflet";

const MARKER_COLORS = {
  emerald: "#059669",
  amber: "#f59e0b",
  blue: "#3b82f6",
  violet: "#8b5cf6",
} as const;

export type MarkerColor = keyof typeof MARKER_COLORS;

/** Marqueurs HTML personnalisés (pas d'assets PNG Leaflet) */
export function createMarkerIcon(color: MarkerColor = "emerald", pulse = false) {
  const hex = MARKER_COLORS[color];
  return L.divIcon({
    className: "diambar-marker",
    html: `<span class="diambar-marker-pin ${pulse ? "diambar-marker-pulse" : ""}" style="--marker-color:${hex}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}
