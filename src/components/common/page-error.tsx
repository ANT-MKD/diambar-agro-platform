import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageError({
  title = "Une erreur est survenue",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {message && <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{message}</p>}
      {onRetry && (
        <Button onClick={onRetry} className="mt-4">
          Réessayer
        </Button>
      )}
    </div>
  );
}
