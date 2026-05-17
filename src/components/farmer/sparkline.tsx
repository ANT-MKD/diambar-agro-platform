import { Area, AreaChart, Bar, BarChart, ResponsiveContainer } from "recharts";

export function Sparkline({ data, type = "area", color = "oklch(0.7 0.17 155)" }: { data: number[]; type?: "area" | "bar"; color?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-12 w-full">
      <ResponsiveContainer>
        {type === "area" ? (
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#sp-${color})`} />
          </AreaChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ProgressCircle({ value, max, color = "oklch(0.7 0.17 155)" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = 18;
  const c = 2 * Math.PI * r;
  const off = c - (c * pct) / 100;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
      <circle cx="24" cy="24" r={r} stroke="currentColor" strokeOpacity={0.15} strokeWidth="4" fill="none" />
      <circle cx="24" cy="24" r={r} stroke={color} strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
    </svg>
  );
}