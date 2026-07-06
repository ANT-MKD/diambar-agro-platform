import { Check, X } from "lucide-react";
import { useOnboarding, onboardingActions } from "@/data/store";

type Item = { key: string; label: string; href?: string };

export function OnboardingChecklist({
  storageKey,
  title = "Complétez votre profil",
  items,
}: {
  storageKey: string;
  title?: string;
  items: Item[];
}) {
  const state = useOnboarding();
  if (state[`__dismiss_${storageKey}`]) return null;
  const done = items.filter((i) => state[i.key]).length;
  const total = items.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="glass rounded-2xl p-5 relative">
      <button aria-label="Fermer" onClick={() => onboardingActions.dismiss(storageKey)} className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-lg hover:bg-accent text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
            <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" className="text-primary" strokeWidth="4" strokeDasharray={`${(pct / 100) * 100.5} 200`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-[10px] font-bold">{done}/{total}</div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{pct === 100 ? "Tout est prêt 🎉" : `${total - done} étape(s) restante(s) pour finaliser votre compte.`}</p>
        </div>
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-2">
        {items.map((it) => {
          const isDone = !!state[it.key];
          return (
            <button
              key={it.key}
              onClick={() => onboardingActions.toggle(it.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-left transition ${isDone ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent"}`}
            >
              <span className={`h-5 w-5 rounded-md grid place-items-center shrink-0 border ${isDone ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                {isDone && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={`flex-1 truncate ${isDone ? "line-through text-muted-foreground" : ""}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}