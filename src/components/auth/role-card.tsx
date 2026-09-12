import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

export function RoleCard({
  icon: Icon,
  title,
  desc,
  accent,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: "emerald" | "amber" | "blue" | "violet";
  selected: boolean;
  onClick: () => void;
}) {
  const accentMap: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-500/10 text-emerald-500",
    amber: "border-amber-500 bg-amber-500/10 text-amber-500",
    blue: "border-blue-500 bg-blue-500/10 text-blue-500",
    violet: "border-violet-500 bg-violet-500/10 text-violet-500",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative glass rounded-2xl p-5 text-left transition-all hover:scale-[1.02] w-full ${
        selected ? `${accentMap[accent]} scale-[1.02] shadow-xl` : "border-border"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-current text-background">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
      <Icon className="h-7 w-7" />
      <div className="mt-3 font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
