import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type QuickAction = {
  icon: LucideIcon;
  label: string;
  to: string;
  tone: "emerald" | "blue" | "violet" | "amber" | "rose";
};

const TONE_CLASS: Record<QuickAction["tone"], string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function QuickActions({
  title = "Actions rapides",
  actions,
}: {
  title?: string;
  actions: QuickAction[];
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => (
          <Link
            key={a.label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={a.to as any}
            className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center hover:border-primary/40 hover:bg-accent/40 transition"
          >
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${TONE_CLASS[a.tone]}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
