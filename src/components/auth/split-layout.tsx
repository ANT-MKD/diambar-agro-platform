import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const slides = [
  {
    src: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=1400&q=80",
    caption: "Tomates fraîches · Ferme Diallo, Thiès",
  },
  {
    src: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1400&q=80",
    caption: "Récolte du jour · Niayes",
  },
  {
    src: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80",
    caption: "Marché de Dakar · circuits courts",
  },
  {
    src: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=1400&q=80",
    caption: "Livraison express · Oumar, livreur Wave",
  },
  {
    src: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=1400&q=80",
    caption: "Cuisine sénégalaise · du champ à l'assiette",
  },
];

export function AuthSplitLayout({ children }: { children: ReactNode }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left visual */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 text-white overflow-hidden bg-neutral-950">
        {slides.map((s, k) => (
          <div
            key={s.src}
            aria-hidden
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ${k === i ? "opacity-100" : "opacity-0"}`}
            style={{ backgroundImage: `url(${s.src})` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/85 via-neutral-950/60 to-emerald-950/70" />
        <div className="absolute inset-0 bg-grid opacity-15" />
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
          <div className="text-xs text-white/70 italic">{slides[i].caption}</div>
        </div>
        <div className="relative flex items-end justify-between gap-4">
          <div className="grid grid-cols-3 gap-3 max-w-sm flex-1">
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
          <div className="flex gap-1.5">
            {slides.map((_, k) => (
              <button
                key={k}
                aria-label={`Slide ${k + 1}`}
                onClick={() => setI(k)}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-emerald-400" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 lg:p-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
