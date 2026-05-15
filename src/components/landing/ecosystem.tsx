import { ArrowRight, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";

const profiles = [
  {
    emoji: "👨🏾‍🌾", role: "Agriculteurs", subtitle: "Vendez plus, sans intermédiaire",
    color: "emerald", border: "border-emerald-500/30", bg: "bg-emerald-500/5",
    items: ["Publiez vos produits en 2 minutes", "Recevez des commandes régulières", "Gérez votre stock en temps réel", "Encaissez via Wave ou Orange Money", "Notez vos clients"],
    stat: "Revenus moyens +40%",
    href: "/register?role=farmer",
  },
  {
    emoji: "🍽️", role: "Restaurants", subtitle: "Approvisionnez-vous mieux, moins cher",
    color: "amber", border: "border-amber-500/30", bg: "bg-amber-500/5",
    items: ["Parcourez le catalogue complet", "Comparez les prix en temps réel", "Commandez en quelques clics", "Suivez vos livraisons en GPS", "Historique de toutes vos commandes"],
    stat: "Économies -25% en approvisionnement",
    href: "/register?role=restaurant",
  },
  {
    emoji: "🚚", role: "Livreurs", subtitle: "Des missions, des revenus, de la liberté",
    color: "blue", border: "border-blue-500/30", bg: "bg-blue-500/5",
    items: ["Acceptez ou refusez les missions", "Navigation GPS intégrée", "Wallet et historique de revenus", "Statut online/offline", "Paiement rapide sur Wave"],
    stat: "Jusqu'à 85 000 FCFA/mois",
    href: "/register?role=driver",
  },
  {
    emoji: "🧑🏾‍💻", role: "Administrateurs", subtitle: "Contrôlez tout l'écosystème",
    color: "violet", border: "border-violet-500/30", bg: "bg-violet-500/5",
    items: ["Validez les comptes utilisateurs", "Surveillez toutes les livraisons", "Gérez les commissions", "Rapports financiers complets", "Support et gestion des litiges"],
    stat: "Vision 360° de la plateforme",
    href: "/register?role=admin",
  },
];

export function Ecosystem() {
  return (
    <section id="ecosystem" className="py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-emerald-500 font-semibold text-sm uppercase tracking-wider">Écosystème</p>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-bold">Une plateforme, quatre acteurs</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {profiles.map((p) => (
            <div key={p.role} className={`glass rounded-3xl p-6 ${p.border} ${p.bg} flex flex-col hover:-translate-y-1 transition-transform`}>
              <div className="text-4xl">{p.emoji}</div>
              <h3 className="mt-4 font-display text-xl font-bold">{p.role}</h3>
              <p className="text-sm text-muted-foreground">{p.subtitle}</p>
              <ul className="mt-5 space-y-2 flex-1">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm">
                    <Check className={`h-4 w-4 text-${p.color}-500 mt-0.5 shrink-0`} />
                    <span className="text-foreground/80">{it}</span>
                  </li>
                ))}
              </ul>
              <div className={`mt-5 rounded-xl border ${p.border} ${p.bg} p-3 text-center text-sm font-semibold text-${p.color}-500`}>
                {p.stat}
              </div>
              <Link to={p.href} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 px-4 py-2.5 text-sm font-semibold transition group">
                Rejoindre <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
