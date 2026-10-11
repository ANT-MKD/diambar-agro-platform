import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function BentoKpi({
  icon: Icon,
  label,
  value,
  suffix,
  trend,
  tone = "emerald",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
  trend?: string;
  tone?: "emerald" | "amber" | "blue" | "violet" | "rose" | "yellow";
  children?: ReactNode;
}) {
  const toneClass: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-blue-500/10 text-blue-500",
    violet: "bg-violet-500/10 text-violet-500",
    rose: "bg-rose-500/10 text-rose-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
  };
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between gap-2">
        <div
          className={`grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl ${toneClass[tone]}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {trend && (
          <span className="text-[11px] sm:text-xs text-emerald-500 font-semibold text-right truncate">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3 sm:mt-4 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-lg sm:text-2xl font-bold tracking-tight leading-tight">
          {value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5 line-clamp-2">
        {label}
      </div>
      {children && <div className="mt-3 -mx-1">{children}</div>}
    </div>
  );
}
