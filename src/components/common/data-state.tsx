import { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  loading?: boolean;
  error?: Error | string | null;
  empty?: boolean;
  onRetry?: () => void;
  skeleton?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  children: ReactNode;
};

export function DataState({
  loading,
  error,
  empty,
  onRetry,
  skeleton,
  emptyTitle = "Rien à afficher",
  emptyDescription = "Aucune donnée disponible pour le moment.",
  emptyIcon,
  emptyAction,
  children,
}: Props) {
  if (loading) {
    return (
      <div className="w-full">
        {skeleton ?? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (error) {
    const msg = typeof error === "string" ? error : error.message;
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-semibold">Une erreur est survenue</h3>
        <p className="mt-1 text-sm text-muted-foreground">{msg}</p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-4 gap-2">
            <Loader2 className="h-4 w-4" /> Réessayer
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          {emptyIcon ?? <Inbox className="h-7 w-7" />}
        </div>
        <h3 className="mt-4 font-semibold">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{emptyDescription}</p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }
  return <>{children}</>;
}
