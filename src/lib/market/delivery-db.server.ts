import { eq } from "drizzle-orm";
import { cities, farmers, settings, zones } from "@/db/schema";
import {
  deliveryFee,
  estimateDistanceKm,
  normalizePricing,
  type DeliveryPricing,
  type DeliveryQuote,
  type FarmerPlaceRow,
  type PlaceRow,
} from "@/lib/delivery-pricing";
import { findPlace, REFERENCE_PLACES, type Coords } from "@/lib/places";
import type { Q } from "./market-common.server";

// Positions et barème de livraison, côté serveur (qui fait foi).

export type Located = Coords & { name: string };

export async function readDeliveryPricing(q: Q): Promise<DeliveryPricing> {
  const [row] = await q
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "delivery_pricing"));
  return normalizePricing(row?.value);
}

export type PlaceDirectory = {
  /** Villes et quartiers en base, par identifiant. */
  byId: Map<string, Located | null>;
  /** Noms connus (référence, puis positions réglées par l'admin). */
  byName: Record<string, Coords>;
};

/** Position de chaque ville et quartier : celle réglée par l'admin, sinon
 * celle de référence. Jamais devinée : un quartier inconnu reste sans
 * position (et non au centre de sa ville). */
export async function readPlaces(q: Q): Promise<PlaceDirectory> {
  const cityRows = await q.select().from(cities);
  const zoneRows = await q.select().from(zones);
  const byName: Record<string, Coords> = { ...REFERENCE_PLACES };
  for (const r of [...cityRows, ...zoneRows]) {
    if (r.lat != null && r.lng != null) byName[r.name] = { lat: r.lat, lng: r.lng };
  }
  const byId = new Map<string, Located | null>();
  for (const c of cityRows) {
    const p = c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : byName[c.name];
    byId.set(c.id, p ? { name: c.name, ...p } : findPlace(c.name, byName, { wide: false }));
  }
  for (const z of zoneRows) {
    const own = z.lat != null && z.lng != null ? { name: z.name, lat: z.lat, lng: z.lng } : null;
    byId.set(
      z.id,
      own ??
        (byName[z.name] ? { name: z.name, ...byName[z.name] } : null) ??
        findPlace(z.name, byName, { wide: false }),
    );
  }
  return { byId, byName };
}

/** Lieu de collecte d'un producteur : sa position précise, sinon son
 * quartier, sinon le lieu cité dans son adresse. */
export function farmerOrigin(
  f: { lat: number | null; lng: number | null; zoneId: string | null; pickupAddress: string },
  dir: PlaceDirectory,
): Located | null {
  if (f.lat != null && f.lng != null)
    return { name: "Position du producteur", lat: f.lat, lng: f.lng };
  if (f.zoneId) {
    const z = dir.byId.get(f.zoneId);
    if (z) return z;
  }
  return findPlace(f.pickupAddress, dir.byName);
}

export function quoteDelivery(
  origin: Coords,
  destination: Coords,
  weightKg: number,
  pricing: DeliveryPricing,
  adjustKm = 0,
): DeliveryQuote {
  const km = estimateDistanceKm(origin, destination, pricing.roadFactor, adjustKm);
  return deliveryFee(km, weightKg, pricing);
}

// --- Réglages (admin) -----------------------------------------------------------------

export async function readDeliverySettings(q: Q) {
  const pricing = await readDeliveryPricing(q);
  const dir = await readPlaces(q);
  const cityRows = await q.select().from(cities);
  const zoneRows = await q.select().from(zones);
  const cityName = new Map(cityRows.map((c) => [c.id, c.name]));
  const places: PlaceRow[] = [
    ...cityRows.map((c) => ({
      id: c.id,
      kind: "city" as const,
      name: c.name,
      cityName: c.name,
      active: c.active,
      raw: c,
    })),
    ...zoneRows.map((z) => ({
      id: z.id,
      kind: "zone" as const,
      name: z.name,
      cityName: cityName.get(z.cityId) ?? "",
      active: z.active,
      raw: z,
    })),
  ].map(({ raw, ...p }) => {
    const resolved = dir.byId.get(p.id) ?? null;
    const own = raw.lat != null && raw.lng != null;
    return {
      ...p,
      lat: resolved?.lat ?? null,
      lng: resolved?.lng ?? null,
      source: own ? "admin" : resolved ? "reference" : null,
    } satisfies PlaceRow;
  });
  const farmerRows = await q.select().from(farmers);
  const farmerList: FarmerPlaceRow[] = farmerRows.map((f) => ({
    id: f.userId,
    farmName: f.farmName,
    pickupAddress: f.pickupAddress,
    origin: farmerOrigin(f, dir)?.name ?? null,
    lat: f.lat,
    lng: f.lng,
    adjustKm: f.distanceAdjustKm,
  }));
  return { pricing, places, farmers: farmerList };
}

/** Le Sénégal et ses environs : une position hors de ce cadre est une erreur. */
export function checkSenegal(lat: number, lng: number) {
  return lat >= 12 && lat <= 16.8 && lng >= -17.7 && lng <= -11.3;
}
