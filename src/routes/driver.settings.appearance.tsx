import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/driver/settings/appearance")({
  head: () => ({ meta: [{ title: "Langue & apparence · Paramètres livreur" }] }),
  component: AppearanceSettings,
});

const THEMES = [
  { v: "light", label: "Clair", icon: Sun },
  { v: "dark", label: "Sombre", icon: Moon },
  { v: "system", label: "Automatique", icon: Monitor },
] as const;

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold">Apparence</h3>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTheme(t.v)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition ${mounted && theme === t.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-2">
        <h3 className="font-semibold">Langue</h3>
        <p className="text-sm text-muted-foreground">
          🇫🇷 Français — seule langue disponible pour le moment sur Diambar Agro.
        </p>
      </div>
    </div>
  );
}
