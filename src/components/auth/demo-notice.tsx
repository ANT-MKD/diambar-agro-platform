import { FlaskConical } from "lucide-react";

/** Bandeau affiché sur les écrans de connexion quand l'application tourne en
 * mode démonstration : codes affichés à l'écran, comptes en un clic. */
export function DemoNotice() {
  return (
    <div
      role="note"
      className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <b>Mode démonstration</b> — les codes de vérification et les liens s'affichent à l'écran au
        lieu d'être envoyés. N'utilisez pas de données réelles.
      </span>
    </div>
  );
}
