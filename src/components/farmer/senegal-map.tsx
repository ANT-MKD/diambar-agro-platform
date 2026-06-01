import { Plus, Minus, Navigation2, MapPin } from "lucide-react";
import { useState } from "react";
import { geoPins } from "@/data/mocks";

/**
 * Carte du Sénégal en simulation "vraie carte" (style satellite/streets)
 * avec contrôles zoom, grille de rues, et pins animés par région.
 */
export function SenegalMap() {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="relative w-full aspect-[4/3] rounded-xl border border-border overflow-hidden">
      {/* Map base */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{
          transform: `scale(${zoom})`,
          backgroundImage:
            "radial-gradient(ellipse at 25% 30%, oklch(0.34 0.06 145) 0%, transparent 55%), radial-gradient(ellipse at 70% 55%, oklch(0.28 0.05 160) 0%, transparent 55%), radial-gradient(ellipse at 50% 85%, oklch(0.25 0.04 220) 0%, transparent 50%), linear-gradient(135deg, oklch(0.22 0.03 200), oklch(0.18 0.025 180))",
        }}
      />
      {/* Grid streets */}
      <svg className="absolute inset-0 w-full h-full opacity-15" preserveAspectRatio="none" viewBox="0 0 100 100">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 7.5} x2="100" y2={i * 7.5} stroke="white" strokeWidth="0.15" />
        ))}
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 6.5} y1="0" x2={i * 6.5} y2="100" stroke="white" strokeWidth="0.15" />
        ))}
      </svg>
      {/* Coast/water glow */}
      <div className="absolute -left-10 top-1/4 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />

      {/* Pins */}
      {geoPins.map((p) => {
        const size = Math.max(20, p.count * 3);
        return (
          <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <div className="relative grid place-items-center">
              <div className="absolute rounded-full animate-ping" style={{ width: size, height: size, background: `${p.color}33` }} />
              <div className="h-8 w-8 rounded-full grid place-items-center text-white text-[10px] font-bold shadow-lg ring-2 ring-white/30" style={{ background: p.color }}>
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <span className="absolute top-9 whitespace-nowrap text-[10px] font-medium glass-strong rounded px-1.5 py-0.5">{p.region} · {p.count}</span>
            </div>
          </div>
        );
      })}

      {/* Controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent"><Plus className="h-3.5 w-3.5" /></button>
        <button onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent"><Minus className="h-3.5 w-3.5" /></button>
        <button className="h-8 w-8 grid place-items-center glass-strong rounded-lg hover:bg-accent"><Navigation2 className="h-3.5 w-3.5 text-primary" /></button>
      </div>

      {/* Attribution */}
      <div className="absolute left-3 bottom-2 text-[9px] text-white/60 font-medium">Sénégal · Vue commandes</div>
    </div>
  );
}