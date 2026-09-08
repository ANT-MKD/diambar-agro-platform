import { Eye } from "lucide-react";
import { toast } from "sonner";
import { useImpersonation, impersonationActions } from "@/data/impersonation";

export function ImpersonationBanner() {
  const imp = useImpersonation();
  if (!imp) return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
      <Eye className="h-3.5 w-3.5" />
      <span>Vous naviguez en tant que <strong>{imp.name}</strong> ({imp.role}) — mode support</span>
      <button
        onClick={() => { impersonationActions.stop(); toast.success("Retour à votre compte administrateur"); }}
        className="rounded-full border border-amber-500/40 px-2.5 py-0.5 hover:bg-amber-500/20"
      >
        Quitter
      </button>
    </div>
  );
}
