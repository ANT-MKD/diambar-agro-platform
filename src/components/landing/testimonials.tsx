import { useEffect, useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { testimonials } from "@/data/mocks";
import { motion, AnimatePresence } from "framer-motion";

export function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    // Respecte à la fois "réduire les animations" du système et le survol :
    // un carrousel qui avance tout seul sans possibilité de pause est un
    // vrai problème d'accessibilité (WCAG 2.2.2), pas juste un détail visuel.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduceMotion) return;
    const id = setInterval(() => setI((x) => (x + 1) % testimonials.length), 5000);
    return () => clearInterval(id);
  }, [paused]);
  const t = testimonials[i];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center mb-10">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">
            Témoignages
          </p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">
            Ce qu'ils disent de nous
          </h2>
        </div>
        <div
          className="relative glass-strong rounded-3xl p-8 lg:p-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex gap-1 text-amber-400 mb-4">
                {Array.from({ length: t.rating }).map((_, k) => (
                  <Star key={k} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl lg:text-2xl font-display leading-relaxed">
                "{t.text}"
              </blockquote>
              <div className="mt-6 flex items-center gap-4">
                <img src={t.avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-sm text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {testimonials.map((_, k) => (
                <button
                  key={k}
                  onClick={() => setI(k)}
                  className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setI((x) => (x - 1 + testimonials.length) % testimonials.length)}
                className="grid h-10 w-10 place-items-center rounded-full glass hover:bg-accent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setI((x) => (x + 1) % testimonials.length)}
                className="grid h-10 w-10 place-items-center rounded-full glass hover:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
