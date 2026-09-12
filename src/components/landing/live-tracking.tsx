import { motion } from "framer-motion";
import { Star, Phone, Package } from "lucide-react";
import type { CSSProperties } from "react";

export function LiveTracking() {
  return (
    <section className="py-24 bg-card/30">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">
            Suivi en direct
          </p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">
            Suivez votre livraison en temps réel
          </h2>
        </div>
        <div className="grid lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 glass rounded-3xl p-2 relative overflow-hidden h-[480px]">
            <div className="absolute inset-2 rounded-[20px] bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900 overflow-hidden">
              {/* fake map grid */}
              <div className="absolute inset-0 bg-grid opacity-20" />
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 800 480"
                preserveAspectRatio="none"
              >
                <path
                  d="M80,400 Q300,300 400,250 Q550,180 720,80"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  fill="none"
                />
                <circle cx="80" cy="400" r="14" fill="#10b981" opacity="0.3" />
                <circle cx="80" cy="400" r="8" fill="#10b981" />
                <circle cx="720" cy="80" r="14" fill="#f59e0b" opacity="0.3" />
                <circle cx="720" cy="80" r="8" fill="#f59e0b" />
                <motion.g
                  animate={{ offsetDistance: ["0%", "100%"] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  style={
                    {
                      offsetPath: "path('M80,400 Q300,300 400,250 Q550,180 720,80')",
                    } as CSSProperties & { offsetPath: string }
                  }
                >
                  <circle r="10" fill="white" />
                  <circle r="14" fill="white" opacity="0.3" />
                </motion.g>
              </svg>
              <div className="absolute top-4 left-4 glass-strong rounded-xl px-3 py-2 text-xs">
                <div className="text-emerald-300 font-medium">Ferme Diallo · Thiès</div>
              </div>
              <div className="absolute bottom-4 right-4 glass-strong rounded-xl px-3 py-2 text-xs">
                <div className="text-amber-300 font-medium">Le Baobab · Dakar</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200"
                alt="Oumar Ba"
                className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-500/40"
              />
              <div className="flex-1">
                <div className="font-semibold">Oumar Ba</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.9 · 234 missions
                </div>
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white hover:scale-110 transition">
                <Phone className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <div className="text-xs text-emerald-300">ARRIVÉE DANS</div>
              <div className="font-display text-3xl font-bold text-emerald-400 mt-1">23 min</div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: "Récupéré", done: true },
                { label: "En route", done: true, current: true },
                { label: "Livré", done: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${s.done ? "bg-emerald-500" : "bg-muted"} ${s.current ? "ring-4 ring-emerald-500/30 animate-pulse" : ""}`}
                  />
                  <span
                    className={`text-sm ${s.done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-5 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" /> Tomates 50kg + Oignons 30kg
              </div>
              <div className="text-xs text-muted-foreground mt-1">Commande #CMD-2847</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
