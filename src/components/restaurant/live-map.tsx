import { motion } from "framer-motion";
import { Plus, Minus, Navigation2, MapPin, Truck } from "lucide-react";
import { useEffect, useState } from "react";

type Pt = { x: number; y: number; label: string };

/**
 * Simulated "real" map: layered gradients to mimic satellite/streets,
 * SVG road network, animated vehicle marker following a polyline.
 */
export function LiveMap({
  origin = { x: 18, y: 72, label: "Ferme Diallo · Thiès" },
  destination = { x: 78, y: 28, label: "Le Baobab · Dakar" },
  progress = 0.55,
  driverName = "Oumar Ba",
  height = 340,
}: {
  origin?: Pt;
  destination?: Pt;
  progress?: number;
  driverName?: string;
  height?: number;
}) {
  const [zoom, setZoom] = useState(1);
  // Bezier curve from origin to destination
  const cx = (origin.x + destination.x) / 2 + 8;
  const cy = (origin.y + destination.y) / 2 - 18;
  const pathD = `M ${origin.x} ${origin.y} Q ${cx} ${cy} ${destination.x} ${destination.y}`;

  // Position along quadratic bezier at t = progress
  const t = Math.max(0, Math.min(1, progress));
  const bx = (1 - t) * (1 - t) * origin.x + 2 * (1 - t) * t * cx + t * t * destination.x;
  const by = (1 - t) * (1 - t) * origin.y + 2 * (1 - t) * t * cy + t * t * destination.y;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border" style={{ height }}>
      {/* Satellite-style base */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          transform: `scale(${zoom})`,
          backgroundImage:
            "radial-gradient(ellipse at 20% 30%, oklch(0.32 0.05 145) 0%, transparent 50%), radial-gradient(ellipse at 75% 60%, oklch(0.28 0.06 160) 0%, transparent 55%), radial-gradient(ellipse at 50% 90%, oklch(0.25 0.04 220) 0%, transparent 45%), linear-gradient(135deg, oklch(0.22 0.03 200), oklch(0.18 0.025 180))",
        }}
      />
      {/* Grid streets */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            y1={i * 8.5}
            x2="100"
            y2={i * 8.5}
            stroke="white"
            strokeWidth="0.15"
          />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={i * 7.5}
            y1="0"
            x2={i * 7.5}
            y2="100"
            stroke="white"
            strokeWidth="0.15"
          />
        ))}
      </svg>
      {/* Water/coast splash */}
      <div className="absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="absolute right-10 -bottom-10 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Route overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.7 0.17 155)" />
            <stop offset="100%" stopColor="oklch(0.75 0.18 50)" />
          </linearGradient>
        </defs>
        {/* Glow */}
        <path d={pathD} stroke="oklch(0.7 0.17 155)" strokeWidth="2.5" fill="none" opacity="0.25" />
        <path
          d={pathD}
          stroke="url(#routeGrad)"
          strokeWidth="0.8"
          fill="none"
          strokeDasharray="2 1.5"
          strokeLinecap="round"
        />
        {/* Origin */}
        <circle
          cx={origin.x}
          cy={origin.y}
          r="2"
          fill="oklch(0.7 0.17 155)"
          stroke="white"
          strokeWidth="0.6"
        />
        {/* Destination */}
        <circle
          cx={destination.x}
          cy={destination.y}
          r="2"
          fill="oklch(0.65 0.22 25)"
          stroke="white"
          strokeWidth="0.6"
        />
      </svg>

      {/* Animated vehicle (HTML for crisp icon) */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        animate={{ left: `${bx}%`, top: `${by}%` }}
        transition={{ type: "spring", stiffness: 60, damping: 20 }}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
          <div className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-xl ring-2 ring-white/30">
            <Truck className="h-4 w-4" />
          </div>
        </div>
      </motion.div>

      {/* Origin/dest labels */}
      <div className="absolute" style={{ left: `${origin.x}%`, top: `${origin.y}%` }}>
        <div className="-translate-x-1/2 -translate-y-[140%] glass-strong rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
          <MapPin className="inline h-3 w-3 mr-0.5 text-primary" />
          {origin.label}
        </div>
      </div>
      <div className="absolute" style={{ left: `${destination.x}%`, top: `${destination.y}%` }}>
        <div className="-translate-x-1/2 -translate-y-[140%] glass-strong rounded-md px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
          <MapPin className="inline h-3 w-3 mr-0.5 text-rose-500" />
          {destination.label}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
          className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}
          className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent">
          <Navigation2 className="h-3.5 w-3.5 text-primary" />
        </button>
      </div>

      {/* Bottom driver chip */}
      <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between glass-strong rounded-xl p-2 pl-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <span className="text-xs font-medium">{driverName} en route</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{Math.round(t * 100)}% du trajet</span>
      </div>
    </div>
  );
}

export function useSimulatedProgress(initial = 0.1, step = 0.015, intervalMs = 1500) {
  const [p, setP] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setP((v) => (v >= 0.98 ? v : +(v + step).toFixed(3))), intervalMs);
    return () => clearInterval(id);
  }, [step, intervalMs]);
  return p;
}
