import { Logo } from "@/components/common/logo";
import { Facebook, Instagram, Linkedin, MessageCircle, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo showTag />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">Logistique alimentaire moderne au Sénégal. Made with ❤️ in Dakar.</p>
            <div className="mt-5 flex gap-2">
              {[Facebook, Instagram, MessageCircle, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="grid h-9 w-9 place-items-center rounded-xl glass hover:bg-emerald-500/10 hover:text-emerald-500 transition">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Plateforme</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Agriculteurs</a></li>
              <li><a href="#" className="hover:text-foreground">Restaurants</a></li>
              <li><a href="#" className="hover:text-foreground">Livreurs</a></li>
              <li><a href="#" className="hover:text-foreground">Tarifs</a></li>
              <li><a href="#" className="hover:text-foreground">API</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Centre d'aide</a></li>
              <li><a href="#" className="hover:text-foreground">Nous contacter</a></li>
              <li><a href="#" className="hover:text-foreground">Signaler un problème</a></li>
              <li><a href="#" className="hover:text-foreground">Conditions d'utilisation</a></li>
              <li><a href="#" className="hover:text-foreground">Confidentialité</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-500" />contact@diambar-agro.sn</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-500" />+221 77 000 00 00</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" />Dakar, Sénégal</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© 2025 Diambar Agro · Tous droits réservés</span>
          <span>Fait avec ❤️ au Sénégal 🇸🇳</span>
        </div>
      </div>
    </footer>
  );
}
