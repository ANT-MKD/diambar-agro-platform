import { useCallback, useEffect, useState } from "react";
import { startLiveTracking } from "@/lib/tracking/engine";
import { resolveTrackingConfig } from "@/lib/tracking/resolve-config";
import { getLiveTracking, subscribeLiveTracking } from "@/lib/tracking/store";
import type { LiveTrackingSnapshot } from "@/lib/tracking/types";

interface UseLiveTrackingOptions {
  trackingId: string | undefined;
  driverName?: string;
  /** Démarre la simulation si aucune session active */
  autoStart?: boolean;
  enabled?: boolean;
}

export function useLiveTracking({
  trackingId,
  driverName = "Oumar Ba",
  autoStart = true,
  enabled = true,
}: UseLiveTrackingOptions) {
  const [snapshot, setSnapshot] = useState<LiveTrackingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!trackingId) {
      setSnapshot(null);
      return;
    }
    setSnapshot(getLiveTracking(trackingId));
  }, [trackingId]);

  useEffect(() => {
    if (!enabled || !trackingId) {
      setSnapshot(null);
      return;
    }

    refresh();
    const unsub = subscribeLiveTracking(refresh);
    return unsub;
  }, [enabled, trackingId, refresh]);

  useEffect(() => {
    if (!enabled || !trackingId || !autoStart) return;

    const existing = getLiveTracking(trackingId);
    if (existing) return;

    const config = resolveTrackingConfig(trackingId, driverName);
    if (!config) return;

    let cancelled = false;
    setLoading(true);
    startLiveTracking(config)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, trackingId, driverName, autoStart]);

  return { snapshot, loading, refresh };
}
