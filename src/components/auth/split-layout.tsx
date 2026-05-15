import type { ReactNode } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left visual */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-hero-dark text-white overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative space-y-6">
          <div className="glass-strong rounded-2xl p-5 max-w-sm">
            <div className="text-xs text-emerald-300">COMMANDE EN COURS</div>
            <div className="font-semibold mt-1">Le Baobab → Mamadou Diallo</div>
            <div className="text-sm text-white/70 mt-1">Tomates 50kg · 42 500 FCFA</div>
            <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-emerald-500" />
            </div>
          </div>
          <div className="glass-strong rounded-2xl p-5 max-w-sm ml-12">
            <div className="text-xs text-amber-300">LIVRAISON ARRIVÉE</div>
            <div className="font-semibold mt-1">Oumar Ba · ★ 4.9</div>
            <div className="text-sm text-white/70 mt-1">Livraison effectuée en 23 min</div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-4 max-w-md">
          {[
            { v: "50+", l: "Agriculteurs" },
            { v: "120+", l: "Cmd/sem" },
            { v: "4.9★", l: "Satisfaction" },
          ].map((s) => (
            <div key={s.l} className="glass rounded-xl p-3 text-center">
              <div className="font-display text-2xl font-bold">{s.v}</div>
              <div className="text-[11px] text-white/60 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden"><Logo /></div>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
