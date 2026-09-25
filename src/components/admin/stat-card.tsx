import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  hint?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold ${up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {up ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <div className="mt-3 sm:mt-4 font-display text-lg sm:text-2xl font-bold leading-tight break-words">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground/70 mt-2 line-clamp-2">{hint}</div>}
    </div>
  );
}
