import { useEffect, useMemo, useState } from "react";
import { Navigation, Satellite, Gauge, Clock, Radio, Share2 } from "lucide-react";
import { LiveMap } from "@/components/restaurant/live-map";
import { Switch } from "@/components/ui/switch";

/** Deterministic pseudo-coordinates around Senegal for a given city name. */
function cityCoords(city: string): { lat: number; lng: number } {
  const base: Record<string, [number, number]> = {
    Dakar: [14.7167, -17.4677],
    Thiès: [14.7886, -16.9246],
    "Saint-Louis": [16.0179, -16.4896],
    Kaolack: [14.1652, -16.0726],
    Ziguinchor: [12.5833, -16.2719],
    Touba: [14.8667, -15.8833],
    Mbour: [14.4198, -16.9646],
    Louga: [15.6144, -16.2264],
  };
  const hit = base[city];
  if (hit) return { lat: hit[0], lng: hit[1] };
  let h = 0;
  for (const ch of city) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return { lat: 12.5 + (h % 400) / 100, lng: -17.5 + (h % 300) / 100 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function GpsPanel({
  pickupCity,
  dropoffCity,
  distanceKm,
  estimatedMinutes,
  driverName,
  live,
  startProgress = 0,
}: {
  pickupCity: string;
  dropoffCity: string;
  distanceKm: number;
  estimatedMinutes: number;
  driverName: string;
  live: boolean;
  startProgress?: number;
}) {
  const [progress, setProgress] = useState(startProgress);
  const [share, setShare] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 0.985 ? p : +(p + 0.012).toFixed(3)));
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, [live]);

  const a = useMemo(() => cityCoords(pickupCity), [pickupCity]);
  const b = useMemo(() => cityCoords(dropoffCity), [dropoffCity]);

  // Simulated GPS jitter so coordinates feel like a real device feed
  const jitter = ((tick % 7) - 3) / 10000;
  const lat = lerp(a.lat, b.lat, progress) + jitter;
  const lng = lerp(a.lng, b.lng, progress) - jitter;

  const remainingKm = Math.max(0, +(distanceKm * (1 - progress)).toFixed(1));
  const etaMin = Math.max(0, Math.round(estimatedMinutes * (1 - progress)));
  const speed = live ? 34 + ((tick * 7) % 23) : 0;
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
        <LiveMap
          origin={{ x: 18, y: 72, label: pickupCity }}
          destination={{ x: 78, y: 28, label: dropoffCity }}
          progress={progress}
          driverName={driverName}
          height={300}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-4">
        <Metric
          icon={Satellite}
          label="Coordonnées"
          value={`${lat.toFixed(4)}, ${lng.toFixed(4)}`}
        />
        <Metric icon={Gauge} label="Vitesse" value={`${speed} km/h`} />
        <Metric icon={Navigation} label="Restant" value={`${remainingKm} km`} />
        <Metric icon={Clock} label="ETA" value={`${etaMin} min · ${etaClock}`} />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl bg-muted/40 p-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" />
          {share
            ? `Position relayée au restaurant toutes les 2 s · précision ±${8 + (tick % 5)} m (simulation)`
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
