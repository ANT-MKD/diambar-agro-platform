import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import { drivers, missionPositions, missions, users } from "@/db/schema";
import { haversineKm } from "@/lib/tracking/geo-math";
import { fail, type Q } from "./market-common.server";

// Position GPS réelle des livreurs, envoyée par leur téléphone : application
// Android (y compris en arrière-plan, pendant que le livreur suit Waze ou
// Google Maps) ou navigateur tant que la page est ouverte.
// Confidentialité : rien n'est enregistré en dehors d'une course démarrée
// (de la route vers la collecte jusqu'à la livraison). On garde la dernière
// position, et le trajet de ces courses (utile à l'équipe pour un retard ou
// un litige).

export const ACTIVE_MISSION_STATUSES = ["accepted", "pickup", "loaded"] as const;
/** Courses démarrées : les seules pendant lesquelles la position est reçue. */
export const TRACKED_MISSION_STATUSES = ["pickup", "loaded"] as const;
/** Un point de trajet au plus toutes les 15 s, sauf déplacement de plus de 50 m. */
const TRACK_MIN_INTERVAL_MS = 15_000;
const TRACK_MIN_MOVE_KM = 0.05;
/** Au-delà de cette imprécision (mètres), le point ne va pas dans le trajet. */
const TRACK_MAX_ACCURACY_M = 150;
/** Point arrivé trop tard (réseau coupé longtemps) : ignoré. */
const MAX_POINT_AGE_MS = 30 * 60_000;
/** Une position plus ancienne n'est plus montrée sur les cartes. */
export const POSITION_SHOWN_MS = 30 * 60_000;

export type PositionInput = {
  lat: number;
  lng: number;
  /** Rayon d'incertitude en mètres. */
  accuracy?: number | null;
  /** Cap en degrés (0 = nord). */
  heading?: number | null;
  speedKmh?: number | null;
  /** Heure de la mesure (ms depuis 1970) ; à défaut, maintenant. */
  at?: number | null;
};

export type DriverPosition = {
  lat: number;
  lng: number;
  heading: number | null;
  accuracyM: number | null;
  speedKmh: number | null;
  at: string;
  /** Le livreur accepte que le restaurant voie sa position. */
  sharing: boolean;
};

const finite = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Enregistre une position. `tracking: false` : le téléphone peut arrêter
 * d'envoyer (aucune course démarrée, ou compte inactif). */
export async function reportPosition(
  db: Db,
  driverId: string,
  input: PositionInput,
  now = new Date(),
): Promise<{ tracking: boolean }> {
  const { lat, lng } = input;
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) {
    fail("Position invalide.");
  }
  const [d] = await db
    .select({ status: users.status, role: users.role })
    .from(drivers)
    .innerJoin(users, eq(users.id, drivers.userId))
    .where(eq(drivers.userId, driverId));
  if (!d || d.role !== "driver") fail("Compte livreur introuvable.");
  if (d.status !== "active") return { tracking: false };
  const active = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(eq(missions.driverId, driverId), inArray(missions.status, [...TRACKED_MISSION_STATUSES])),
    );
  if (!active.length) return { tracking: false };

  const measured = finite(input.at);
  const at = new Date(Math.min(now.getTime(), measured ?? now.getTime()));
  if (now.getTime() - at.getTime() > MAX_POINT_AGE_MS) return { tracking: true };
  const accuracy = finite(input.accuracy);
  const heading = finite(input.heading);
  const speed = finite(input.speedKmh);

  // Une mesure plus ancienne que la dernière connue ne la remplace pas.
  const [last] = await db
    .select({ at: drivers.lastPositionAt })
    .from(drivers)
    .where(eq(drivers.userId, driverId));
  if (!last?.at || last.at.getTime() <= at.getTime()) {
    await db
      .update(drivers)
      .set({
        lastLat: lat,
        lastLng: lng,
        lastAccuracyM: accuracy,
        lastHeading: heading != null && heading >= 0 ? heading % 360 : null,
        lastSpeedKmh: speed != null && speed >= 0 ? speed : null,
        lastPositionAt: at,
      })
      .where(eq(drivers.userId, driverId));
  }

  if (accuracy == null || accuracy <= TRACK_MAX_ACCURACY_M) {
    for (const m of active) {
      const [prev] = await db
        .select()
        .from(missionPositions)
        .where(eq(missionPositions.missionId, m.id))
        .orderBy(desc(missionPositions.at))
        .limit(1);
      const due =
        !prev ||
        at.getTime() - prev.at.getTime() >= TRACK_MIN_INTERVAL_MS ||
        haversineKm(prev, { lat, lng }) >= TRACK_MIN_MOVE_KM;
      if (due && (!prev || at.getTime() > prev.at.getTime())) {
        await db
          .insert(missionPositions)
          .values({ missionId: m.id, lat, lng, accuracyM: accuracy, at });
      }
    }
  }
  return { tracking: true };
}

/** Dernières positions connues de plusieurs livreurs (récentes seulement). */
export async function readDriverPositions(
  q: Q,
  driverIds: string[],
  now = new Date(),
): Promise<Map<string, DriverPosition>> {
  if (!driverIds.length) return new Map();
  const rows = await q
    .select({
      id: drivers.userId,
      lat: drivers.lastLat,
      lng: drivers.lastLng,
      heading: drivers.lastHeading,
      accuracy: drivers.lastAccuracyM,
      speed: drivers.lastSpeedKmh,
      at: drivers.lastPositionAt,
      sharing: drivers.locationSharing,
    })
    .from(drivers)
    .where(inArray(drivers.userId, driverIds));
  const out = new Map<string, DriverPosition>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null || !r.at) continue;
    if (now.getTime() - r.at.getTime() > POSITION_SHOWN_MS) continue;
    out.set(r.id, {
      lat: r.lat,
      lng: r.lng,
      heading: r.heading,
      accuracyM: r.accuracy,
      speedKmh: r.speed,
      at: r.at.toISOString(),
      sharing: r.sharing,
    });
  }
  return out;
}

/** Trajet réel d'une course, réduit à 300 points au plus pour la carte. */
export async function readMissionTrack(
  q: Q,
  missionId: string,
): Promise<{ lat: number; lng: number; at: string }[]> {
  const rows = await q
    .select({ lat: missionPositions.lat, lng: missionPositions.lng, at: missionPositions.at })
    .from(missionPositions)
    .where(eq(missionPositions.missionId, missionId))
    .orderBy(asc(missionPositions.at));
  const step = Math.max(1, Math.ceil(rows.length / 300));
  return rows
    .filter((_, i) => i % step === 0 || i === rows.length - 1)
    .map((r) => ({ lat: r.lat, lng: r.lng, at: r.at.toISOString() }));
}
