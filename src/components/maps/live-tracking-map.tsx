import { useMemo, useState } from "react";
import { Crosshair, Loader2, Wifi, WifiOff } from "lucide-react";
import { DiambarMap } from "./diambar-map";
import { useLiveTracking } from "@/hooks/use-live-tracking";
import { pointAlongRoute } from "@/lib/tracking/geo-math";
import { cn } from "@/lib/utils";
import { TrackingStepBar } from "./tracking-step-bar";

export interface LiveTrackingMapProps {
  trackingId: string;
  driverName?: string;
  accent?: "sky" | "emerald" | "violet" | "amber";
  minHeight?: number;
  autoStart?: boolean;
  className?: string;
}

export function LiveTrackingMap({
  trackingId,
  driverName = "Oumar Ba",
  accent = "emerald",
  minHeight = 420,
  autoStart = true,
  className,
}: LiveTrackingMapProps) {
  const [follow, setFollow] = useState(true);
  const { snapshot, loading } = useLiveTracking({
    trackingId,
    driverName,
    autoStart,
    enabled: !!trackingId,
  });

  const mapData = useMemo(() => {
    if (!snapshot) return null;

    const idx = Math.max(1, Math.ceil(snapshot.progress * (snapshot.route.length - 1)));
    const driverPoint = pointAlongRoute(snapshot.route, snapshot.progress);
    const traveled = [...snapshot.route.slice(0, idx), driverPoint];
    const remaining = [driverPoint, ...snapshot.route.slice(idx)];

    const markers = [
      {
        id: "pickup",
        ...snapshot.pickup,
        label: snapshot.pickup.label,
        color: "blue" as const,
        description: "Collecte",
      },
      {
        id: "driver",
        ...snapshot.driver,
        label: snapshot.driverName,
        color: "emerald" as const,
        pulse: true,
        description: `ETA ~${snapshot.etaMinutes} min`,
      },
      {
        id: "dropoff",
        ...snapshot.dropoff,
        label: snapshot.dropoff.label,
        color: "amber" as const,
        description: "Destination",
      },
    ];

    const accentColor =
      accent === "sky"
        ? "#0284c7"
        : accent === "violet"
          ? "#7c3aed"
          : accent === "amber"
            ? "#d97706"
            : "#10b981";

    return {
      markers,
      routes: [
        { points: traveled, color: accentColor, weight: 5, opacity: 1 },
        { points: remaining, color: "#94a3b8", weight: 4, opacity: 0.65, dashed: true },
      ],
      followPosition: [snapshot.driver.lat, snapshot.driver.lng] as [number, number],
      center: [
        (snapshot.pickup.lat + snapshot.dropoff.lat) / 2,
        (snapshot.pickup.lng + snapshot.dropoff.lng) / 2,
      ] as [number, number],
    };
  }, [snapshot, accent]);

  if (loading && !snapshot) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-border bg-muted/40",
          className,
        )}
        style={{ minHeight }}
      >
        <Loader2
          className={cn(
            "h-8 w-8 animate-spin",
            accent === "sky"
              ? "text-sky-600"
              : accent === "violet"
                ? "text-violet-600"
                : "text-emerald-600",
          )}
        />
        <span className="ml-3 text-sm text-muted-foreground">Calcul de l&apos;itinéraire…</span>
      </div>
    );
  }

  if (!snapshot || !mapData) {
    return (
      <div
        className={cn(
          "glass flex items-center justify-center p-8 text-sm text-muted-foreground",
          className,
        )}
        style={{ minHeight }}
      >
        Suivi indisponible pour cette commande
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border", className)}>
      <DiambarMap
        markers={mapData.markers}
        routes={mapData.routes}
        center={mapData.center}
        minHeight={minHeight}
        fitBounds={!follow}
        followPosition={follow ? mapData.followPosition : null}
        zoom={9}
      />

      <div className="pointer-events-none absolute top-3 right-3 left-3">
        <div className="pointer-events-auto rounded-xl glass-strong px-3 py-2 shadow-lg">
          <TrackingStepBar current={snapshot.step} accent={accent} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFollow((f) => !f)}
        className={cn(
          "absolute right-3 bottom-28 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors",
          follow &&
            (accent === "sky"
              ? "text-sky-600 ring-2 ring-sky-500/40"
              : accent === "violet"
                ? "text-violet-600 ring-2 ring-violet-500/40"
                : "text-emerald-600 ring-2 ring-emerald-500/40"),
        )}
        aria-label={follow ? "Arrêter le suivi carte" : "Recentrer sur le livreur"}
      >
        <Crosshair className="h-5 w-5" />
      </button>

      <div className="absolute right-3 bottom-3 left-3">
        <div className="rounded-2xl glass-strong p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {snapshot.trackingId}
              </p>
              <p className="mt-0.5 font-display text-2xl font-bold text-primary">
                {snapshot.etaMinutes}
                <span className="ml-1 text-base font-normal text-muted-foreground">min</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {snapshot.driverName} ·{" "}
                {snapshot.step === "pickup"
                  ? "vers la collecte"
                  : snapshot.step === "dropoff"
                    ? "arrivée imminente"
                    : "en route vers vous"}
              </p>
            </div>
            <div
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                snapshot.gpsLive
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-amber-500/15 text-amber-600",
              )}
            >
              {snapshot.gpsLive ? (
                <>
                  <Wifi className="h-3 w-3" />
                  GPS live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Simulé
                </>
              )}
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                accent === "sky"
                  ? "bg-sky-500"
                  : accent === "violet"
                    ? "bg-violet-500"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.round(snapshot.progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Itinéraire OSRM · {snapshot.pickup.label} → {snapshot.dropoff.label}
          </p>
        </div>
      </div>
    </div>
  );
}
