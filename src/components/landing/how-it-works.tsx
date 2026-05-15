import { motion } from "framer-motion";
import { Sprout, UtensilsCrossed, Truck } from "lucide-react";

const steps = [
  {
    icon: Sprout,
    n: "01",
    title: "Les producteurs publient leurs stocks",
    desc: "Mamadou Diallo ajoute ses 200kg de tomates fraîches à 850 FCFA/kg. Photos, quantité, délai de récolte — tout est visible en temps réel.",
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800",
    accent: "from-emerald-500/30 to-emerald-700/10",
  },
  {
    icon: UtensilsCrossed,
    n: "02",
    title: "Les restaurants commandent directement",
    desc: "Le Baobab parcourt le catalogue, compare les prix, ajoute au panier et valide. Sans intermédiaire, sans appel téléphonique.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    accent: "from-amber-500/30 to-orange-700/10",
  },
  {
    icon: Truck,
    n: "03",
    title: "Les livreurs assurent la livraison",
    desc: "Oumar Ba reçoit la mission, récupère chez Mamadou et livre au Baobab. Suivi GPS en temps réel pour le restaurant.",
    image: "https://images.unsplash.com/photo-1601758174039-4ed7a4d2c0bd?w=800",
    accent: "from-blue-500/30 to-blue-700/10",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">Processus</p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">Simple. Rapide. Direct.</h2>
          <p className="mt-4 text-muted-foreground text-lg">3 étapes pour révolutionner votre approvisionnement</p>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <motion.div key={s.n}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="glass rounded-3xl p-6 hover:scale-[1.02] transition-transform">
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-emerald-300" style={{ backgroundImage: `linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 60%, black))` }}>
                  <s.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="font-display text-4xl font-extrabold text-foreground/10">{s.n}</span>
              </div>
              <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              <div className={`mt-6 h-40 rounded-2xl overflow-hidden bg-gradient-to-br ${s.accent}`}>
                <img src={s.image} alt={s.title} className="h-full w-full object-cover opacity-90" loading="lazy" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
