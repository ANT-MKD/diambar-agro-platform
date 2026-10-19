import { Users } from "lucide-react";
import { useTeamBase } from "@/data/store";

/** Rappel discret pour un membre d'équipe : l'espace est celui de
 * l'établissement, et son rôle limite ce qu'il peut y faire. */
export function TeamMemberBanner() {
  const { session } = useTeamBase();
  if (!session) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Users className="h-3.5 w-3.5 shrink-0" />
      <span>
        Espace de <b className="text-foreground">{session.ownerName}</b> · vous êtes{" "}
        {session.memberName} ({session.roleLabel})
      </span>
    </div>
  );
}
