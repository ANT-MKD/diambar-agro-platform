import { motion } from "framer-motion";
import {
  Truck,
  Map,
  MessageCircle,
  Smartphone,
  BarChart3,
  Box,
  ShoppingCart,
  MonitorSmartphone,
  Bell,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Truck,
    title: "Livraison temps réel",
    desc: "Suivez chaque commande de l'exploitation à votre cuisine",
  },
  { icon: Map, title: "Suivi GPS", desc: "Tracking en temps réel de vos livreurs sur la carte" },
  {
    icon: MessageCircle,
    title: "Chat instantané",
    desc: "Communiquez directement avec agriculteurs et livreurs",
  },
  { icon: Smartphone, title: "Mobile Money", desc: "Wave, Orange Money, Free Money intégrés" },
  {
    icon: BarChart3,
    title: "Analytics avancés",
    desc: "Chiffre d'affaires journalier, mensuel, annuel exportable",
  },
  {
    icon: Box,
    title: "Gestion de stock",
    desc: "Alertes automatiques de rupture, codes SKU, codes-barres",
  },
  {
    icon: ShoppingCart,
    title: "Commandes intelligentes",
    desc: "Panier, historique, commandes récurrentes",
  },
  { icon: MonitorSmartphone, title: "Dashboard SaaS", desc: "Interface dédiée pour chaque rôle" },
  {
    icon: Bell,
    title: "Notifications live",
    desc: "Alertes push instantanées pour chaque événement",
  },
  {
    icon: Shield,
    title: "Producteurs vérifiés",
    desc: "Tous les agriculteurs sont vérifiés et notés",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-card/30">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">
            Fonctionnalités
          </p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">
            Tout ce dont vous avez besoin
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Une suite complète pour gérer votre activité de bout en bout.
          </p>
        </div>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 5) * 0.05 }}
              className="glass rounded-2xl p-5 hover:scale-[1.04] hover:border-emerald-500/30 transition-all group cursor-default"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-sm">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
