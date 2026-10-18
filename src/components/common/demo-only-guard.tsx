import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { useHiddenInBase } from "@/data/demo-only";

/** Contenu du portail, sauf pour un écran pas encore relié à la base : un
 * message le remplace (accès par un lien direct ou un ancien favori). */
export function DemoOnlyOutlet({ home }: { home: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden = useHiddenInBase();
  if (!hidden(path)) return <Outlet />;
  return (
    <div className="p-4" data-testid="not-available">
      <EmptyState
        icon={Construction}
        title="Pas encore disponible"
        description="Cette partie de l'application n'est pas encore reliée à la base de données. Elle sera ouverte dans une prochaine version."
        action={
          <Button asChild variant="outline">
            <Link to={home}>Retour à l'accueil</Link>
          </Button>
        }
      />
    </div>
  );
}
