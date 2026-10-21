export type MapTheme = "light" | "dark";

// Fond de carte OpenStreetMap. Par défaut, les tuiles d'openstreetmap.org
// (gratuites pour un usage modéré, attribution obligatoire). Pour plus de
// trafic, un fournisseur de tuiles OSM (MapTiler, Stadia, Thunderforest…) se
// règle sans toucher au code :
//   VITE_MAP_TILES_URL            ex. https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=…
//   VITE_MAP_TILES_DARK_URL       facultatif ; sinon le fond clair est assombri
//   VITE_MAP_TILES_ATTRIBUTION    mention exigée par le fournisseur
// (la clé d'un fournisseur de tuiles est publique : elle part au navigateur ;
// la restreindre au domaine du site chez le fournisseur).

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>';

const env = import.meta.env as Record<string, string | undefined>;
const customLight = env.VITE_MAP_TILES_URL?.trim();
const customDark = env.VITE_MAP_TILES_DARK_URL?.trim();
const customAttribution = env.VITE_MAP_TILES_ATTRIBUTION?.trim();

const lightUrl = customLight || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution = customLight ? customAttribution || OSM_ATTRIBUTION : OSM_ATTRIBUTION;

export const TILE_LAYERS = {
  light: { url: lightUrl, attribution, dimmed: false },
  // Sans fond sombre dédié, le fond clair est assombri en CSS (.map-tiles-dimmed).
  dark: customDark
    ? { url: customDark, attribution, dimmed: false }
    : { url: lightUrl, attribution, dimmed: true },
} as const;

export function getTileLayer(theme: MapTheme) {
  return TILE_LAYERS[theme];
}
