import type { LucideIcon } from "lucide-react";

export function KpiCard({ icon: Icon, label, value, change, tone = "emerald" }: { icon: LucideIcon; label: string; value: string; change?: string; tone?: "emerald" | "amber" | "blue" | "violet" | "rose" }) {
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-blue-500/10 text-blue-500",
    violet: "bg-violet-500/10 text-violet-500",
    rose: "bg-rose-500/10 text-rose-500",
  };
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {change && <span className="text-xs text-emerald-500 font-semibold">{change}</span>}
      </div>
      <div className="mt-4 font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}