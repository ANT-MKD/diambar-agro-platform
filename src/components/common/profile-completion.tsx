import { Link } from "@tanstack/react-router";
import { Check, AlertTriangle } from "lucide-react";
import { completionPct, type CompletionItem } from "@/lib/profile-completion";

export function ProfileCompletion({
  title = "Profil complété",
  items,
}: {
  title?: string;
  items: CompletionItem[];
}) {
  const pct = completionPct(items);
  const missing = items.filter((i) => !i.done);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-sm font-bold text-primary">{pct}%</span>
      </div>
      <div className="mt-2.5 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {pct === 100 ? "Votre profil est complet 🎉" : `${missing.length} élément(s) à compléter.`}
      </p>
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.href}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
              it.done
                ? "border-primary/30 bg-primary/5 text-muted-foreground"
                : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-md grid place-items-center shrink-0 ${
                it.done
                  ? "bg-primary text-primary-foreground"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {it.done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
            </span>
            <span className={`flex-1 truncate ${it.done ? "line-through" : ""}`}>{it.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
