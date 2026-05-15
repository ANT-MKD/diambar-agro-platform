import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      aria-label="Basculer le thème"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`glass relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 hover:scale-105 ${className}`}
    >
      <span
        className={`absolute top-1 h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 flex items-center justify-center ${
          mounted && isDark ? "translate-x-8" : "translate-x-1"
        }`}
      >
        {mounted && isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
