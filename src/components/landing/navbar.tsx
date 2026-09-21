import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const links = [
  { label: "Agriculteurs", to: "/for-farmers" },
  { label: "Restaurants", to: "/for-restaurants" },
  { label: "Livreurs", to: "/for-drivers" },
  { label: "Tarifs", to: "/pricing" },
  { label: "Blog", to: "/blog" },
  { label: "FAQ", to: "/faq" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-4"}`}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all ${scrolled ? "glass-strong shadow-xl" : ""}`}
        >
          <Logo />
          <nav className="hidden lg:flex items-center gap-6">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeProps={{ className: "text-foreground" }}
                className="text-sm font-medium text-foreground/70 hover:text-foreground transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden md:inline-flex" />
            <Link
              to="/login"
              className="hidden md:inline-flex items-center text-sm font-medium px-3 py-2 rounded-lg hover:bg-accent transition"
            >
              Se connecter
            </Link>
            <Link
              to="/register"
              className="hidden md:inline-flex items-center text-sm font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition"
            >
              Commencer
            </Link>
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden mt-2 glass-strong rounded-2xl p-4 flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Link
                to="/login"
                className="flex-1 text-center px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="flex-1 text-center px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Commencer
              </Link>
            </div>
            <div className="pt-2">
              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
