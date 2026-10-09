import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

// Petits éléments communs du site public (thème clair) : étiquette
// numérotée, titres très serrés, bouton « encre » arrondi.

export function Eyebrow({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="eyebrow text-foreground/80">
      {index && <span className="text-emerald-700">{index} · </span>}
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`display-xl mt-4 text-[2.4rem] sm:text-6xl lg:text-7xl text-balance ${className}`}
    >
      {children}
    </h2>
  );
}

export function AccessCta({
  label = "Demander l'accès",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to="/demande-acces"
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-neutral-900/15 transition hover:bg-neutral-800 ${className}`}
    >
      {label}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

/** Fond doux du site : halos vert tendre et sable, sans image externe. */
export function SoftGlow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-emerald-300/40 blur-3xl" />
      <div className="absolute -top-24 right-[-10%] h-[460px] w-[460px] rounded-full bg-lime-200/60 blur-3xl" />
      <div className="absolute top-[45%] left-[30%] h-[380px] w-[380px] rounded-full bg-amber-100/70 blur-3xl" />
    </div>
  );
}
