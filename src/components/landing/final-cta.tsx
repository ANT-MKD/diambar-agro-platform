import { Link } from "@tanstack/react-router";

export function FinalCta() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div
          className="relative rounded-[32px] overflow-hidden p-10 lg:p-16 text-center text-white"
          style={{
            background: "linear-gradient(135deg, oklch(0.4 0.18 155), oklch(0.25 0.12 160))",
          }}
        >
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <h2 className="font-display text-4xl lg:text-6xl font-bold">
              Prêt à transformer
              <br />
              votre business ?
            </h2>
            <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
              Rejoignez 50+ acteurs qui révolutionnent la chaîne alimentaire au Sénégal
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/register"
                className="rounded-xl bg-white text-emerald-700 px-6 py-3.5 text-sm font-semibold hover:scale-105 transition"
              >
                Créer mon compte
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-white/30 bg-white/10 backdrop-blur px-6 py-3.5 text-sm font-semibold hover:bg-white/20 transition"
              >
                Nous contacter
              </Link>
            </div>
            <p className="mt-6 text-xs text-white/60">
              Inscription gratuite · Aucune carte requise · Support en Wolof et Français
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
