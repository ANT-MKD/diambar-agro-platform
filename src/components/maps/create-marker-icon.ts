import L from "leaflet";
import { pinHtml, vehicleHtml, type MarkerColor } from "./marker-html";

export type { MarkerColor } from "./marker-html";

/** Marqueurs HTML personnalisés (pas d'assets PNG Leaflet) */
export function createMarkerIcon(color: MarkerColor = "emerald", pulse = false) {
  return L.divIcon({
    className: "diambar-marker",
    html: pinHtml(color, pulse),
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

/** Livreur : flèche orientée selon son cap (degrés, 0 = nord). */
export function createVehicleIcon(heading: number | null, color: MarkerColor = "emerald") {
  return L.divIcon({
    className: "diambar-marker",
    html: vehicleHtml(color, true, heading != null, heading ?? 0),
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}
