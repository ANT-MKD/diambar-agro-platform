import { Wrench } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { LogoutButton } from "@/components/common/logout-button";

export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <Logo />
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-bold">Maintenance en cours</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="pt-2">
          <LogoutButton className="inline-flex items-center gap-2 rounded-xl border border-border px-4 h-10 text-sm font-medium hover:bg-accent" />
        </div>
      </div>
    </div>
  );
}
