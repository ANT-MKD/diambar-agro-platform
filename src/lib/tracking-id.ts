import type { RestaurantOrder } from "@/data/mocks";

/** Jeton aléatoire du lien de suivi public, impossible à deviner. */
export function newTrackingToken() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12)
    .toUpperCase();
}

/** Identifiant public du suivi d'une commande. Les anciennes commandes de
 * démo, sans jeton, gardent leur identifiant dérivé de l'id. */
export function publicTrackingId(o: Pick<RestaurantOrder, "id" | "trackingToken">) {
  if (o.trackingToken) return `TRK-${o.trackingToken}`;
  return `TRK-${o.id
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()}`;
}
