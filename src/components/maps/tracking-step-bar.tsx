import { cn } from "@/lib/utils";
import type { TrackingStep } from "@/lib/tracking/types";

const STEPS: { key: TrackingStep; label: string }[] = [
  { key: "pickup", label: "Collecte" },
  { key: "transit", label: "En route" },
  { key: "dropoff", label: "Livraison" },
];

interface TrackingStepBarProps {
  current: TrackingStep;
  accent?: "sky" | "emerald" | "violet" | "amber";
}

export function TrackingStepBar({ current, accent = "emerald" }: TrackingStepBarProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-1">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  done &&
                    (accent === "sky"
                      ? "bg-sky-600 text-white"
                      : accent === "amber"
                        ? "bg-amber-600 text-white"
                        : accent === "violet"
                          ? "bg-violet-600 text-white"
                          : "bg-emerald-600 text-white"),
                  active &&
                    (accent === "sky"
                      ? "bg-sky-600 text-white ring-4 ring-sky-500/30"
                      : "bg-emerald-600 text-white ring-4 ring-emerald-500/30"),
                  !done && !active && "border border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-0.5 flex-1 rounded-full",
                  done
                    ? accent === "sky"
                      ? "bg-sky-500"
                      : accent === "violet"
                        ? "bg-violet-500"
                        : "bg-emerald-500"
                    : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
