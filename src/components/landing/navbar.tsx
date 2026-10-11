import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Logo } from "@/components/common/logo";

const solutionLinks = [
  { label: "Agriculteurs", to: "/for-farmers" },
  { label: "Restaurants", to: "/for-restaurants" },
  { label: "Livreurs", to: "/for-drivers" },
] as const;

// Ancres de la page d'accueil, puis pages publiques.
const anchors = [
  { label: "Comment ça marche", hash: "comment" },
  { label: "Garanties", hash: "garanties" },
] as const;

const links = [
  { label: "Tarifs", to: "/pricing" },
  { label: "FAQ", to: "/faq" },
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
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <div
          className={`flex items-center justify-between rounded-full border border-black/5 bg-white/85 px-3 py-2 pl-4 backdrop-blur-xl transition-all ${scrolled ? "shadow-lg shadow-black/5" : "shadow-sm"}`}
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
            {anchors.map((a) => (
              <Link
                key={a.hash}
                to="/"
                hash={a.hash}
                className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:text-foreground transition"
              >
                {a.label}
              </Link>
            ))}
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
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="hidden md:inline-flex items-center text-sm font-medium px-3 py-2 rounded-full hover:bg-black/5 transition"
            >
              Connexion
            </Link>
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center text-sm font-semibold px-4 py-2.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition"
            >
              Créer un compte
            </Link>
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden p-2 rounded-full hover:bg-black/5"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden mt-2 rounded-3xl border border-black/5 bg-white p-4 shadow-xl flex flex-col gap-2">
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
              {anchors.map((a) => (
                <Link
                  key={a.hash}
                  to="/"
                  hash={a.hash}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm font-medium hover:bg-accent"
                >
                  {a.label}
                </Link>
              ))}
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
                className="flex-1 text-center px-3 py-2.5 rounded-full border border-border text-sm font-medium"
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="flex-1 text-center px-3 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-semibold"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
