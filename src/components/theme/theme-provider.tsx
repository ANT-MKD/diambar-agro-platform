import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/** `forcedTheme` impose un thème sans toucher au choix enregistré de
 * l'utilisateur : le site public et les écrans de connexion sont toujours en
 * clair, les portails gardent le thème choisi. */
export function ThemeProvider({
  children,
  forcedTheme,
}: {
  children: ReactNode;
  forcedTheme?: "light" | "dark";
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      {children}
    </NextThemesProvider>
  );
}
