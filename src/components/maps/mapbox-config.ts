// Cartes Mapbox : actives quand VITE_MAPBOX_TOKEN est défini (jeton PUBLIC
// « pk. », envoyé au navigateur, à restreindre au domaine du site dans le
// compte Mapbox). Sans jeton, ou si Mapbox ne charge pas, les cartes
// reviennent à OpenStreetMap (Leaflet).

const env = import.meta.env as Record<string, string | undefined>;

export const MAPBOX_TOKEN = env.VITE_MAPBOX_TOKEN?.trim() ?? "";

/** Style « Standard » de Mapbox (jour / nuit selon le thème), ou un autre style. */
export const MAPBOX_STYLE = env.VITE_MAPBOX_STYLE?.trim() || "mapbox://styles/mapbox/standard";

export const isStandardStyle = (style: string) => style === "mapbox://styles/mapbox/standard";

/** Mapbox demande WebGL : sinon (vieux téléphones), OpenStreetMap. */
export function canUseMapbox(): boolean {
  if (!MAPBOX_TOKEN || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
