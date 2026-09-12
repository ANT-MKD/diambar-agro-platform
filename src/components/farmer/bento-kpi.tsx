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
    <div className="glass rounded-2xl p-5 flex flex-col">
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && <span className="text-xs text-emerald-500 font-semibold">{trend}</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-bold tracking-tight">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {label}
      </div>
      {children && <div className="mt-3 -mx-1">{children}</div>}
    </div>
  );
}
