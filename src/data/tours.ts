import { useMemo, useSyncExternalStore } from "react";
import { haversineKm } from "@/lib/tracking/geo-math";
import { farmers, restaurants, type Mission } from "./mocks";
import { getMissionSnapshot, missionActions, useDriverVehicle, useMissions } from "./store";
import { ensureDataVersion } from "./persist";

export type TourStop = {
  id: string;
  kind: "pickup" | "dropoff";
  label: string;
  address: string;
  city: string;
  contactPhone: string;
  lat: number;
  lng: number;
  weightKg: number;
  missionRef: string;
  missionId: string;
  scheduledFor: string;
  done: boolean;
};

export type Tour = {
  id: string;
  reference: string;
  date: string;
  status: "planned" | "running" | "done";
  vehicle: string;
  stops: TourStop[];
  distanceKm: number;
  payout: number;
};

const ORDER_KEY = "diambar:driver-tour-order";
type OrderMap = Record<string, string[]>;

let orderState: OrderMap = {};
if (typeof window !== "undefined") {
  ensureDataVersion();
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (raw) orderState = JSON.parse(raw) as OrderMap;
  } catch {
    /* ignore */
  }
}
const orderListeners = new Set<() => void>();
function setOrder(tourId: string, ids: string[]) {
  orderState = { ...orderState, [tourId]: ids };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(orderState));
    } catch {
      /* ignore */
    }
  }
  orderListeners.forEach((l) => l());
}
function useOrderMap() {
  return useSyncExternalStore(
    (l) => {
      orderListeners.add(l);
      return () => orderListeners.delete(l);
    },
    () => orderState,
    () => orderState,
  );
}

function buildStops(mission: Mission): TourStop[] {
  const farmer = farmers.find((f) => f.id === mission.farmerId);
  const restaurant = restaurants.find((r) => r.id === mission.restaurantId);
  return [
    {
      id: `${mission.id}-pickup`,
      kind: "pickup",
      label: farmer?.farm ?? mission.pickup.city,
      address: mission.pickup.address,
      city: mission.pickup.city,
      contactPhone: mission.pickup.contactPhone,
      lat: mission.pickup.lat,
      lng: mission.pickup.lng,
      weightKg: mission.weightKg,
      missionRef: mission.reference,
      missionId: mission.id,
      scheduledFor: mission.scheduledFor,
      done: mission.status === "loaded" || mission.status === "delivered",
    },
    {
      id: `${mission.id}-dropoff`,
      kind: "dropoff",
      label: restaurant?.name ?? mission.dropoff.city,
      address: mission.dropoff.address,
      city: mission.dropoff.city,
      contactPhone: mission.dropoff.contactPhone,
      lat: mission.dropoff.lat,
      lng: mission.dropoff.lng,
      weightKg: mission.weightKg,
      missionRef: mission.reference,
      missionId: mission.id,
      scheduledFor: mission.scheduledFor,
      done: mission.status === "delivered",
    },
  ];
}

/** Réordonne les arrêts par plus proche voisin (coordonnées réelles), en
 * respectant la contrainte : une livraison ne peut être visitée qu'après
 * la collecte de la même mission. */
function nearestNeighborOrder(stops: TourStop[]): TourStop[] {
  const remaining = [...stops];
  const pickedUp = new Set(
    stops.filter((s) => s.kind === "pickup" && s.done).map((s) => s.missionId),
  );
  const ordered: TourStop[] = [];
  let current: { lat: number; lng: number } | null = null;

  while (remaining.length > 0) {
    const eligible = remaining.filter((s) => s.kind === "pickup" || pickedUp.has(s.missionId));
    const pool = eligible.length > 0 ? eligible : remaining;
    let bestIdx = 0;
    if (current) {
      let bestDist = Infinity;
      pool.forEach((s, i) => {
        const d = haversineKm(current!, s);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
    }
    const next = pool[bestIdx];
    ordered.push(next);
    current = { lat: next.lat, lng: next.lng };
    if (next.kind === "pickup") pickedUp.add(next.missionId);
    remaining.splice(
      remaining.findIndex((s) => s.id === next.id),
      1,
    );
  }
  return ordered;
}

export function useTours(): Tour[] {
  const missions = useMissions();
  const vehicle = useDriverVehicle();
  const orderMap = useOrderMap();

  return useMemo(() => {
    const mine = missions.filter(
      (m) => m.driverId === "d1" && m.status !== "available" && m.status !== "cancelled",
    );
    const byDate = new Map<string, Mission[]>();
    for (const m of mine) {
      const day = m.scheduledFor.slice(0, 10);
      const arr = byDate.get(day);
      if (arr) arr.push(m);
      else byDate.set(day, [m]);
    }

    const vehicleLabel = `${vehicle.type} · ${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`;

    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, ms]) => {
        const sorted = [...ms].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
        const defaultStops = sorted.flatMap(buildStops);
        const order = orderMap[day];
        const stops = order
          ? [
              ...order
                .map((id) => defaultStops.find((s) => s.id === id))
                .filter((s): s is TourStop => Boolean(s)),
              ...defaultStops.filter((s) => !order.includes(s.id)),
            ]
          : defaultStops;

        const distanceKm = stops.reduce(
          (sum, s, i) => (i === 0 ? 0 : sum + haversineKm(stops[i - 1], s)),
          0,
        );
        const payout = sorted.reduce((s, m) => s + m.payout, 0);
        const allDelivered = sorted.every((m) => m.status === "delivered");
        const anyStarted = sorted.some((m) => m.status !== "accepted");

        return {
          id: day,
          reference: `TRN-${day.slice(5).replace("-", "")}`,
          date: day,
          status: allDelivered ? "done" : anyStarted ? "running" : "planned",
          vehicle: vehicleLabel,
          stops,
          distanceKm: Math.round(distanceKm * 10) / 10,
          payout,
        } satisfies Tour;
      });
  }, [missions, vehicle, orderMap]);
}

export const tourActions = {
  move: (tourId: string, stops: TourStop[], index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= stops.length) return;
    const ids = stops.map((s) => s.id);
    const copy = [...ids];
    const [item] = copy.splice(index, 1);
    copy.splice(to, 0, item);
    setOrder(tourId, copy);
  },
  // Cocher un arrêt fait avancer la mission d'une étape ; on ne décoche
  // jamais : une marchandise chargée ou une livraison confirmée (donc payée)
  // ne peut pas être annulée d'un tap.
  toggleStop: (stop: TourStop): "ok" | "blocked" => {
    const mission = getMissionSnapshot(stop.missionId);
    if (!mission) return "blocked";
    if (stop.kind === "pickup") {
      if (mission.status === "accepted" || mission.status === "pickup") {
        return missionActions.setStatus(stop.missionId, "loaded").ok ? "ok" : "blocked";
      }
      return "blocked";
    }
    if (mission.status === "loaded") {
      return missionActions.setStatus(stop.missionId, "delivered").ok ? "ok" : "blocked";
    }
    return "blocked";
  },
  start: (stops: TourStop[]) => {
    const missionIds = new Set(
      stops.filter((s) => s.kind === "pickup" && !s.done).map((s) => s.missionId),
    );
    missionIds.forEach((id) => {
      if (getMissionSnapshot(id)?.status === "accepted") missionActions.setStatus(id, "pickup");
    });
  },
  /** Clôture : livre uniquement les missions dont la marchandise est chargée.
   * Renvoie le nombre de livraisons confirmées et de missions laissées de côté. */
  finish: (stops: TourStop[]): { delivered: number; skipped: number } => {
    const missionIds = new Set(stops.map((s) => s.missionId));
    let delivered = 0;
    let skipped = 0;
    missionIds.forEach((id) => {
      const status = getMissionSnapshot(id)?.status;
      if (status === "delivered" || status === "cancelled") return;
      if (status === "loaded" && missionActions.setStatus(id, "delivered").ok) delivered++;
      else skipped++;
    });
    return { delivered, skipped };
  },
  optimize: (tourId: string, stops: TourStop[]) => {
    const ordered = nearestNeighborOrder(stops);
    setOrder(
      tourId,
      ordered.map((s) => s.id),
    );
  },
};
