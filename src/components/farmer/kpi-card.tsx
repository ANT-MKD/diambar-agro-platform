import type { LucideIcon } from "lucide-react";

export function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tone = "emerald",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  change?: string;
  tone?: "emerald" | "amber" | "blue" | "violet" | "rose";
}) {
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-blue-500/10 text-blue-500",
    violet: "bg-violet-500/10 text-violet-500",
    rose: "bg-rose-500/10 text-rose-500",
  };
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div
          className={`grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl ${toneClass[tone]}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {change && (
          <span className="text-[11px] sm:text-xs text-emerald-500 font-semibold text-right truncate">
            {change}
          </span>
        )}
      </div>
      <div className="mt-3 sm:mt-4 font-display text-lg sm:text-2xl font-bold leading-tight break-words">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{label}</div>
    </div>
  );
}
