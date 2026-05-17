import { geoPins } from "@/data/mocks";

export function SenegalMap() {
  return (
    <div className="relative w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-emerald-500/5 to-blue-500/5 border border-border overflow-hidden">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        {/* Simplified Senegal outline */}
        <path
          d="M 10 20 Q 14 12, 22 14 L 38 12 Q 50 14, 62 16 L 78 22 Q 82 28, 80 36 L 78 44 Q 76 50, 70 54 L 60 58 L 50 60 L 42 62 Q 36 68, 32 76 L 28 84 Q 22 88, 16 84 L 10 78 Q 6 70, 8 60 L 10 48 Q 8 36, 10 20 Z"
          fill="oklch(0.7 0.17 155 / 0.08)"
          stroke="oklch(0.7 0.17 155)"
          strokeWidth="0.4"
        />
        {geoPins.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r={Math.max(1.6, p.count * 0.35)} fill={p.color} fillOpacity={0.3} />
            <circle cx={p.x} cy={p.y} r={1.2} fill={p.color} />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
        {geoPins.slice(0, 4).map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-card/80 backdrop-blur border border-border px-2 py-0.5 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
            {p.region} · {p.count}
          </span>
        ))}
      </div>
    </div>
  );
}