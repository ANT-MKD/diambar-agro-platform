import { Logo } from "@/components/common/logo";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { telLink, whatsappLink } from "@/lib/public-info-model";
import { usePublicInfo } from "./use-public-info";

export function Footer() {
  const { company } = usePublicInfo();
  const whatsapp = whatsappLink(company.whatsapp || company.phone);
  const tel = telLink(company.phone);
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo showTag />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Produits frais des producteurs sénégalais, livrés aux restaurants le lendemain. Pilote
              en cours à Dakar.
            </p>
            {/* Seul canal affiché : le WhatsApp saisi dans Paramètres →
                Entreprise. Pas de Facebook/Instagram/LinkedIn tant qu'aucun
                compte réel n'existe. */}
            {whatsapp && (
              <div className="mt-5 flex gap-2">
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Nous écrire sur WhatsApp"
                  className="grid h-9 w-9 place-items-center rounded-xl glass hover:bg-emerald-500/10 hover:text-emerald-500 transition"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
          <div>
            <h4 className="font-semibold mb-4">Plateforme</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/for-farmers" className="hover:text-foreground">
                  Agriculteurs
                </Link>
              </li>
              <li>
                <Link to="/for-restaurants" className="hover:text-foreground">
                  Restaurants
                </Link>
              </li>
              <li>
                <Link to="/for-drivers" className="hover:text-foreground">
                  Livreurs
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-foreground">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-foreground">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-foreground">
                  À propos
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/help" className="hover:text-foreground">
                  Centre d'aide
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground">
                  Nous contacter
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-foreground">
                  Questions fréquentes
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="hover:text-foreground">
                  Conditions d'utilisation
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="hover:text-foreground">
                  Confidentialité
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {company.email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-emerald-500" />
                  <a href={`mailto:${company.email}`} className="hover:text-foreground">
                    {company.email}
                  </a>
                </li>
              )}
              {tel && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <a href={tel} className="hover:text-foreground">
                    {company.phone}
                  </a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-500" />
                {company.address || "Dakar, Sénégal"}
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {company.name} · Tous droits réservés
          </span>
          <span>Fait avec ❤️ au Sénégal 🇸🇳</span>
        </div>
      </div>
    </footer>
  );
}
