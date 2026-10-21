// Marqueurs en HTML (pas d'images), communs aux cartes Leaflet et Mapbox.

export const MARKER_COLORS = {
  emerald: "#059669",
  amber: "#f59e0b",
  blue: "#3b82f6",
  violet: "#8b5cf6",
} as const;

export type MarkerColor = keyof typeof MARKER_COLORS;

export function pinHtml(color: MarkerColor = "emerald", pulse = false): string {
  return `<span class="diambar-marker-pin ${pulse ? "diambar-marker-pulse" : ""}" style="--marker-color:${MARKER_COLORS[color]}"></span>`;
}

/**
 * Livreur : pastille blanche avec une flèche dans le sens de la marche (ou un
 * point si la direction est inconnue). `arrowRotation` : rotation appliquée à
 * la flèche elle-même (Leaflet) ; avec Mapbox, c'est le marqueur qui tourne.
 */
export function vehicleHtml(
  color: MarkerColor = "emerald",
  pulse = true,
  hasHeading = true,
  arrowRotation = 0,
): string {
  const hex = MARKER_COLORS[color];
  const inner = hasHeading
    ? `<svg class="diambar-vehicle-arrow" viewBox="0 0 24 24" style="transform:rotate(${Math.round(arrowRotation)}deg)" aria-hidden="true"><polygon points="12 2 19 21 12 17 5 21 12 2" fill="${hex}" stroke="${hex}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
    : `<span class="diambar-vehicle-dot" style="background:${hex}"></span>`;
  return `<span class="diambar-vehicle ${pulse ? "diambar-marker-pulse" : ""}" style="--marker-color:${hex}"><span class="diambar-vehicle-body">${inner}</span></span>`;
}
