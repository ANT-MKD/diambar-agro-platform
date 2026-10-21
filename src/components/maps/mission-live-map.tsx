import { useEffect, useMemo, useState } from "react";
import { Crosshair, Satellite, SatelliteDish } from "lucide-react";
import { DiambarMap, type MapMarkerConfig, type RouteLayer } from "./diambar-map";
import { TrackingStepBar } from "./tracking-step-bar";
import { getMissionTrackFn } from "@/lib/market/functions";
import { agoLabel, estimateMinutes } from "@/lib/tracking/live-eta";
import type { TrackingStep } from "@/lib/tracking/types";
import type { Mission } from "@/data/mocks";
import { cn } from "@/lib/utils";

// Carte d'une course avec la position GPS réelle du livreur (données en base).
// Pas de calcul d'itinéraire : le reste du trajet est tracé à vol d'oiseau et
// la durée est une estimation (vitesses moyennes en ville et sur route).

export interface MissionLiveMapProps {
  mission: Pick<Mission, "id" | "reference" | "status" | "pickup" | "dropoff" | "driverPosition">;
  driverName: string;
  /** Équipe : trajet réellement parcouru depuis le début de la course. */
  showTrack?: boolean;
  /** Le restaurant ne voit la position que pendant la livraison. */
  audience?: "admin" | "driver" | "restaurant";
  minHeight?: number;
  className?: string;
}

/** Au-delà, la position est signalée comme ancienne (signal perdu). */
const FRESH_MS = 2 * 60_000;
const TRACK_REFRESH_MS = 30_000;

function stepOf(status: Mission["status"]): TrackingStep {
  if (status === "loaded") return "transit";
  if (status === "delivered") return "dropoff";
  return "pickup";
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useMissionTrack(
  missionId: string,
  enabled: boolean,
  live: boolean,
  version: string | undefined,
) {
  const [points, setPoints] = useState<{ lat: number; lng: number }[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getMissionTrackFn({ data: { missionId } });
        if (!cancelled && res.ok) setPoints(res.points);
      } catch {
        // Réseau : la carte garde le dernier trajet connu.
      }
    };
    void load();
    const t = live ? window.setInterval(load, TRACK_REFRESH_MS) : undefined;
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [missionId, enabled, live, version]);
  return enabled ? points : [];
}

export function MissionLiveMap({
  mission,
  driverName,
  showTrack = false,
  audience = "admin",
  minHeight = 360,
  className,
}: MissionLiveMapProps) {
  const now = useNow(10_000);
  const [follow, setFollow] = useState(false);
  const [refit, setRefit] = useState(0);
  const pos = mission.driverPosition;
  const finished = mission.status === "delivered" || mission.status === "cancelled";
  const track = useMissionTrack(mission.id, showTrack, !finished, pos?.at);
  const toDropoff = mission.status === "loaded";
  const next = toDropoff ? mission.dropoff : mission.pickup;
  const age = pos ? now - Date.parse(pos.at) : null;
  const fresh = age != null && age < FRESH_MS;

  const pLat = mission.pickup.lat;
  const pLng = mission.pickup.lng;
  const dLat = mission.dropoff.lat;
  const dLng = mission.dropoff.lng;
  const markers = useMemo<MapMarkerConfig[]>(() => {
    const list: MapMarkerConfig[] = [
      {
        id: "pickup",
        lat: pLat,
        lng: pLng,
        label: mission.pickup.address || mission.pickup.city || "Collecte",
        color: "blue",
        description: "Collecte",
      },
      {
        id: "dropoff",
        lat: dLat,
        lng: dLng,
        label: mission.dropoff.address || mission.dropoff.city || "Livraison",
        color: "amber",
        description: "Livraison",
      },
    ];
    if (pos) {
      list.push({
        id: "driver",
        lat: pos.lat,
        lng: pos.lng,
        label: driverName,
        color: "emerald",
        pulse: true,
        zIndexOffset: 1000,
        description: pos.speedKmh != null ? `${Math.round(pos.speedKmh)} km/h` : "Livreur",
      });
    }
    return list;
    // Les adresses ne changent pas pendant une course : seules les coordonnées comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pLat, pLng, dLat, dLng, pos?.lat, pos?.lng, pos?.speedKmh, driverName]);

  const routes = useMemo<RouteLayer[]>(() => {
    const layers: RouteLayer[] = [];
    if (track.length > 1) {
      layers.push({ points: track, color: "#10b981", weight: 5, opacity: 1 });
    }
    if (pos) {
      layers.push({
        points: [
          { lat: pos.lat, lng: pos.lng },
          { lat: next.lat, lng: next.lng },
        ],
        color: "#94a3b8",
        weight: 3,
        opacity: 0.8,
        dashed: true,
      });
      if (!toDropoff) {
        layers.push({
          points: [
            { lat: pLat, lng: pLng },
            { lat: dLat, lng: dLng },
          ],
          color: "#cbd5e1",
          weight: 2,
          opacity: 0.6,
          dashed: true,
        });
      }
    } else {
      layers.push({
        points: [
          { lat: pLat, lng: pLng },
          { lat: dLat, lng: dLng },
        ],
        color: "#94a3b8",
        weight: 3,
        opacity: 0.7,
        dashed: true,
      });
    }
    return layers;
  }, [track, pos, next.lat, next.lng, toDropoff, pLat, pLng, dLat, dLng]);

  const eta = pos && fresh ? estimateMinutes(pos, next) : null;
  // Cadrage : le livreur et son prochain arrêt, plus le trajet déjà parcouru
  // pour l'équipe (sinon toute la course).
  const fitTo = useMemo(
    () =>
      pos
        ? [{ lat: pos.lat, lng: pos.lng }, { lat: next.lat, lng: next.lng }, ...track]
        : undefined,
    [pos, next.lat, next.lng, track],
  );
  const waitingText = finished
    ? track.length > 1
      ? "Course terminée · trajet réel enregistré pendant la course."
      : "Course terminée · aucun trajet enregistré."
    : audience === "restaurant"
      ? toDropoff
        ? "Position du livreur indisponible pour le moment."
        : "La position du livreur s'affichera dès qu'il aura chargé votre commande."
      : "En attente de la position du livreur (application ou page ouverte, GPS autorisé).";

  // Les commandes de Leaflet (zoom en haut à gauche, mentions OpenStreetMap
  // en bas à droite) restent visibles : les infos sont sous la carte.
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="relative">
        <DiambarMap
          className="isolate rounded-none border-0"
          markers={markers}
          routes={routes}
          center={pos ? [pos.lat, pos.lng] : [(pLat + dLat) / 2, (pLng + dLng) / 2]}
          zoom={13}
          minHeight={minHeight}
          fitBounds={!follow}
          fitTo={fitTo}
          fitKey={`${mission.status}|${pos ? 1 : 0}|${track.length > 1 ? 1 : 0}|${refit}`}
          maxFitZoom={15}
          followPosition={follow && pos ? [pos.lat, pos.lng] : null}
          accuracyCircle={
            pos?.accuracyM && fresh ? { lat: pos.lat, lng: pos.lng, radiusM: pos.accuracyM } : null
          }
        />
        {pos && (
          <button
            type="button"
            onClick={() => {
              if (follow) setRefit((n) => n + 1);
              setFollow((f) => !f);
            }}
            className={cn(
              "absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors",
              follow && "text-emerald-600 ring-2 ring-emerald-500/40",
            )}
            aria-label={follow ? "Voir toute la course" : "Suivre le livreur"}
            title={follow ? "Voir toute la course" : "Suivre le livreur"}
          >
            <Crosshair className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {mission.reference}
            </p>
            {eta != null ? (
              <p className="font-display text-xl font-bold text-primary">
                ≈ {eta}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  min {toDropoff ? "avant la livraison" : "avant la collecte"}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{pos ? driverName : waitingText}</p>
            )}
            {pos && (
              <p className="truncate text-xs text-muted-foreground">
                {driverName} · {toDropoff ? "en route vers la livraison" : "vers la collecte"}
              </p>
            )}
          </div>
          {pos && age != null && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                fresh
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              )}
            >
              {fresh ? <Satellite className="h-3 w-3" /> : <SatelliteDish className="h-3 w-3" />}
              {fresh ? `GPS · ${agoLabel(age)}` : `Signal perdu · ${agoLabel(age)}`}
            </div>
          )}
        </div>
        <TrackingStepBar current={stepOf(mission.status)} />
        {eta != null && (
          <p className="text-[10px] text-muted-foreground">
            Durée estimée d&apos;après la distance à vol d&apos;oiseau et des vitesses moyennes
            (ville, route).
          </p>
        )}
      </div>
    </div>
  );
}

export interface FleetLiveMapProps {
  missions: Pick<Mission, "id" | "reference" | "status" | "driverId" | "driverPosition">[];
  driverName: (driverId: string | undefined) => string;
  minHeight?: number;
  className?: string;
}

/** Équipe : tous les livreurs en course, à leur dernière position connue. */
export function FleetLiveMap({
  missions,
  driverName,
  minHeight = 300,
  className,
}: FleetLiveMapProps) {
  const now = useNow(30_000);
  // Un livreur avec plusieurs courses (tournée) n'apparaît qu'une fois.
  const markers = useMemo<MapMarkerConfig[]>(() => {
    const byDriver = new Map<string, MapMarkerConfig>();
    for (const m of missions) {
      const pos = m.driverPosition;
      if (!pos || !m.driverId) continue;
      const prev = byDriver.get(m.driverId);
      if (prev) {
        prev.description = `${prev.description}, ${m.reference}`;
        continue;
      }
      const age = now - Date.parse(pos.at);
      byDriver.set(m.driverId, {
        id: m.driverId,
        lat: pos.lat,
        lng: pos.lng,
        label: driverName(m.driverId),
        color: age < FRESH_MS ? "emerald" : "amber",
        pulse: age < FRESH_MS,
        description: `${agoLabel(age)} · ${m.reference}`,
      });
    }
    return [...byDriver.values()];
  }, [missions, driverName, now]);
  const located = markers.length;
  const waiting = new Set(
    missions.filter((m) => m.driverId && !m.driverPosition).map((m) => m.driverId),
  ).size;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <DiambarMap
        className="isolate rounded-none border-0"
        markers={markers}
        center={markers[0] ? [markers[0].lat, markers[0].lng] : [14.7167, -17.4677]}
        zoom={12}
        minHeight={minHeight}
        fitKey={markers.map((m) => m.id).join(",")}
        maxFitZoom={14}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border p-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Position récente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Signal perdu depuis plus de 2 min
        </span>
        <span className="ml-auto">
          {located} livreur(s) localisé(s)
          {waiting ? ` · ${waiting} sans position` : ""}
        </span>
      </div>
    </div>
  );
}
