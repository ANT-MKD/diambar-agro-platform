import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, AlertTriangle, ChevronDown } from "lucide-react";
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
  const done = items.filter((i) => i.done);
  // Les éléments déjà faits sont repliés : seul ce qui reste à faire occupe
  // de la place, surtout sur téléphone.
  const [showDone, setShowDone] = useState(false);
  const visible = showDone ? items : missing;

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
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
      {visible.length > 0 && (
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {visible.map((it) => (
            <Link
              key={it.label}
              to={it.href}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
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
      )}
      {done.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          aria-expanded={showDone}
          className="mt-2 inline-flex items-center gap-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition ${showDone ? "rotate-180" : ""}`} />
          {showDone
            ? "Masquer les éléments complétés"
            : `Voir les éléments complétés (${done.length})`}
        </button>
      )}
    </div>
  );
}
