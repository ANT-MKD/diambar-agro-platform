import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, MapPin, Package, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

// Des engagements vérifiables dans l'application, pas des chiffres
// d'activité inventés.
const stats = [
  { value: "J+1", label: "Livraison dès le lendemain" },
  { value: "48 h", label: "Pour refuser un produit abîmé" },
  { value: "0 FCFA", label: "D'abonnement" },
  { value: "Code", label: "De remise à chaque livraison" },
];

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-hero">
      {/* particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400/60"
            style={{
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animation: `float-particle ${6 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Plateforme N°1 d'approvisionnement agricole au Sénégal 🇸🇳
          </div>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[0.95] text-foreground">
            Du Champ
            <br />à Votre <span className="text-gradient-emerald">Cuisine</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Une plateforme intelligente qui connecte agriculteurs, restaurants et livreurs dans un
            écosystème moderne de logistique alimentaire au Sénégal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition"
            >
              Commencer maintenant{" "}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-6 py-3.5 text-sm font-semibold text-primary hover:bg-primary/10 transition"
            >
              Devenir partenaire
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative h-[480px] hidden lg:block"
        >
          {/* Floating order card */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-0 right-0 w-80 glass-strong rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-primary font-medium">NOUVELLE COMMANDE</div>
                <div className="font-semibold mt-0.5 text-foreground">Mamadou Diallo</div>
                <div className="text-xs text-muted-foreground">Tomates 50kg + Oignons 30kg</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "65%" }}
                transition={{ duration: 2, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">42 500 FCFA</span>
              <span className="text-primary font-medium">En livraison...</span>
            </div>
          </motion.div>

          {/* Map card */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: 1 }}
            className="absolute top-44 left-0 w-72 glass-strong rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Suivi en temps réel
            </div>
            <div className="mt-3 h-32 rounded-xl bg-gradient-to-br from-primary/15 to-muted relative overflow-hidden">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 120">
                <path
                  d="M20,100 Q80,40 180,30"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  fill="none"
                />
                <circle cx="20" cy="100" r="5" fill="#10b981" />
                <circle cx="180" cy="30" r="5" fill="#f59e0b" />
                <motion.circle
                  r="6"
                  fill="currentColor"
                  stroke="#10b981"
                  strokeWidth="2"
                  animate={{ cx: [20, 180], cy: [100, 30] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
              </svg>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-foreground/70">Oumar Ba</span>
              <span className="text-primary font-medium">ETA 23 min</span>
            </div>
          </motion.div>

          {/* Confirm card */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, delay: 0.5 }}
            className="absolute bottom-4 right-8 w-64 glass-strong rounded-2xl p-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Paiement reçu</div>
                <div className="text-xs text-muted-foreground">+38 250 FCFA · Wave</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
