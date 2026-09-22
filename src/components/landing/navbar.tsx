import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const solutionLinks = [
  { label: "Agriculteurs", to: "/for-farmers" },
  { label: "Restaurants", to: "/for-restaurants" },
  { label: "Livreurs", to: "/for-drivers" },
] as const;

const links = [
  { label: "Tarifs", to: "/pricing" },
  { label: "Blog", to: "/blog" },
  { label: "FAQ", to: "/faq" },
  { label: "À propos", to: "/about" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const solutionsRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const solutionsActive = solutionLinks.some((l) => pathname.startsWith(l.to));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!solutionsOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (solutionsRef.current && !solutionsRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSolutionsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [solutionsOpen]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-4"}`}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div
          className={`flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all ${scrolled ? "glass-strong shadow-xl" : ""}`}
        >
          <Logo />
          <nav className="hidden lg:flex items-center gap-1">
            <div className="relative" ref={solutionsRef}>
              <button
                onClick={() => setSolutionsOpen((v) => !v)}
                aria-expanded={solutionsOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  solutionsActive ? "text-foreground" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                Solutions
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${solutionsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {solutionsOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full mt-2 w-48 glass-strong rounded-xl p-1.5 shadow-xl"
                >
                  {solutionLinks.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      role="menuitem"
                      onClick={() => setSolutionsOpen(false)}
                      activeProps={{ className: "text-foreground bg-accent" }}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent transition"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeProps={{ className: "text-foreground" }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition"
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
            <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Solutions
            </div>
            {solutionLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                activeProps={{ className: "text-foreground bg-accent" }}
                className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-border pt-2 flex flex-col gap-2">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  activeProps={{ className: "text-foreground bg-accent" }}
                  className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent"
                >
                  {l.label}
                </Link>
              ))}
            </div>
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
