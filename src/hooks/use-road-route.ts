import { useEffect, useRef, useState } from "react";
import { MAPBOX_TOKEN } from "@/components/maps/mapbox-config";
import { haversineKm } from "@/lib/tracking/geo-math";
import { fetchRoadRoute, needsReroute, type RoadRoute } from "@/lib/tracking/road-route";
import type { TrackingPoint } from "@/lib/tracking/types";

/** Vers un même arrêt : au plus un calcul toutes les 30 s. */
const MIN_INTERVAL_MS = 30_000;

/**
 * Itinéraire routier de `from` (le livreur) à `to` (son prochain arrêt).
 * Sans jeton Mapbox : null (la carte trace alors une ligne droite).
 */
export function useRoadRoute(
  from: TrackingPoint | null,
  to: TrackingPoint | null,
  enabled: boolean,
): RoadRoute | null {
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const last = useRef<{ at: number; to: TrackingPoint } | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const active = enabled && !!MAPBOX_TOKEN && !!from && !!to;

  useEffect(() => {
    if (!active || !from || !to || busy.current) return;
    if (!needsReroute(route, from, to)) return;
    // Nouvel arrêt : tout de suite. Même arrêt (écart, échec) : 30 s d'intervalle.
    const sameStop = last.current && haversineKm(last.current.to, to) < 0.03;
    if (sameStop && Date.now() - last.current!.at < MIN_INTERVAL_MS) return;
    last.current = { at: Date.now(), to };
    busy.current = true;
    fetchRoadRoute(from, to, MAPBOX_TOKEN)
      .then((r) => {
        if (mounted.current && r) setRoute(r);
      })
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
    // Les coordonnées suffisent : pas besoin de recalculer pour un nouvel objet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, from?.lat, from?.lng, to?.lat, to?.lng, route]);

  return active ? route : null;
}
