import { Navigation, Satellite, Gauge, Clock, Radio, Share2 } from "lucide-react";
import { useState } from "react";
import { LiveTrackingMapLazy } from "@/components/maps/live-tracking-map-lazy";
import { useLiveTracking } from "@/hooks/use-live-tracking";
import { Switch } from "@/components/ui/switch";

export function GpsPanel({
  trackingId,
  distanceKm,
  estimatedMinutes,
  driverName,
  live,
}: {
  trackingId: string;
  distanceKm: number;
  estimatedMinutes: number;
  driverName: string;
  live: boolean;
}) {
  const [share, setShare] = useState(true);
  const { snapshot } = useLiveTracking({
    trackingId,
    driverName,
    autoStart: live,
    enabled: !!trackingId,
  });

  const progress = snapshot?.progress ?? 0;
  const remainingKm = Math.max(0, +(distanceKm * (1 - progress)).toFixed(1));
  const etaMin = snapshot?.etaMinutes ?? estimatedMinutes;
  const avgSpeed = live ? Math.round(distanceKm / (estimatedMinutes / 60)) : 0;
  const etaClock = new Date(Date.now() + etaMin * 60000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span
              className={`block h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground"}`}
            />
            {live && (
              <span className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <span className="text-sm font-semibold">
            {live ? "GPS actif · position transmise" : "GPS en veille"}
          </span>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Share2 className="h-3.5 w-3.5" />
          Partager au client
          <Switch checked={share} onCheckedChange={setShare} />
        </label>
      </div>

      <div className="p-4">
        <LiveTrackingMapLazy
          trackingId={trackingId}
          driverName={driverName}
          minHeight={300}
          autoStart={live}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-4">
        <Metric
          icon={Satellite}
          label="Coordonnées"
          value={
            snapshot ? `${snapshot.driver.lat.toFixed(4)}, ${snapshot.driver.lng.toFixed(4)}` : "—"
          }
        />
        <Metric icon={Gauge} label="Vitesse moy." value={`${avgSpeed} km/h`} />
        <Metric icon={Navigation} label="Restant" value={`${remainingKm} km`} />
        <Metric icon={Clock} label="ETA" value={`${etaMin} min · ${etaClock}`} />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" />
          {share
            ? "Position relayée au restaurant en direct (itinéraire OSRM)"
            : "Partage désactivé : le client ne voit que le statut de la mission."}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Navigation;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-xs font-semibold font-mono">{value}</div>
    </div>
  );
}
