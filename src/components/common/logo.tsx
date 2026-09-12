import { Sprout } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Logo({
  className = "",
  showTag = false,
}: {
  className?: string;
  showTag?: boolean;
}) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-105">
        <Sprout className="h-5 w-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold tracking-tight">
          DIAMBAR <span className="text-gradient-emerald">AGRO</span>
        </span>
        {showTag && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Du Champ à Votre Cuisine
          </span>
        )}
      </span>
    </Link>
  );
}
