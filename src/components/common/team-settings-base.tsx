import { useState } from "react";
import { toast } from "sonner";
import { Copy, History, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { market } from "@/data/market-remote";
import { useTeamBase } from "@/data/store";
import { TEAM_ROLES, type TeamOwnerRole } from "@/lib/market/team";
import { relativeTime } from "@/lib/format";

/** Équipe de l'établissement en mode base : chaque membre a son propre
 * compte, invité par e-mail, et agit dans la limite de son rôle. */
export function TeamSettingsBase({ ownerRole }: { ownerRole: TeamOwnerRole }) {
  const { members, activity, session } = useTeamBase();
  const roles = Object.entries(TEAM_ROLES[ownerRole]).map(([value, def]) => ({
    value,
    label: def.label,
  }));
  const [invite, setInvite] = useState({ email: "", role: roles[0].value });
  const [link, setLink] = useState<string | null>(null);

  if (session) {
    return (
      <div className="glass rounded-2xl p-6 space-y-2">
        <h3 className="font-semibold">Équipe de {session.ownerName}</h3>
        <p className="text-sm text-muted-foreground">
          Vous êtes membre de l'équipe avec le rôle « {session.roleLabel} ». Seul le titulaire du
          compte gère les membres.
        </p>
      </div>
    );
  }

  const showLink = (res: { path?: string; emailed?: boolean }) => {
    if (res.emailed || !res.path) {
      setLink(null);
      return;
    }
    // E-mail non envoyé (envoi pas configuré) : le lien est à transmettre.
    setLink(`${window.location.origin}${res.path}`);
  };

  const sendInvite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(invite.email)) {
      toast.error("Adresse e-mail invalide");
      return false;
    }
    const res = await market.teamAction({ action: "invite", ...invite });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    showLink(res);
    toast.success(
      res.emailed
        ? "Invitation envoyée par e-mail"
        : "Invitation créée · copiez le lien ci-dessous",
    );
    setInvite({ email: "", role: roles[0].value });
    return true;
  };

  return (
    <>
      <SettingsCard
        title="Inviter un collaborateur"
        description="La personne reçoit un lien valable 7 jours pour créer son propre compte. Elle agira dans la limite de son rôle et ses actions seront tracées à son nom."
        onSave={sendInvite}
        saveLabel="Envoyer l'invitation"
      >
        <div className="grid sm:grid-cols-[1fr_200px] gap-4">
          <FieldRow label="E-mail">
            <Input
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="collaborateur@exemple.sn"
            />
          </FieldRow>
          <FieldRow label="Rôle">
            <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
        {link && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              L'envoi d'e-mails n'est pas configuré : transmettez ce lien à la personne invitée.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copier le lien"
                onClick={() => {
                  void navigator.clipboard?.writeText(link);
                  toast.success("Lien copié");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Membres ({members.length})</h3>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Personne d'autre que vous n'a encore accès à cet espace.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.name !== "—" ? m.name : m.email}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.email}
                    {m.lastLoginAt && ` · dernière connexion ${relativeTime(m.lastLoginAt)}`}
                  </div>
                </div>
                {m.status === "invited" && (
                  <span className="text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5">
                    Invitation envoyée
                    {m.expiresAt &&
                      ` · expire le ${new Date(m.expiresAt).toLocaleDateString("fr-FR")}`}
                  </span>
                )}
                <Select
                  value={m.role}
                  onValueChange={async (v) => {
                    const res = await market.teamAction({ action: "role", id: m.id, role: v });
                    if (!res.ok) toast.error(res.message);
                    else toast.success("Rôle mis à jour");
                  }}
                >
                  <SelectTrigger className="w-[170px]" aria-label={`Rôle de ${m.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {m.status === "invited" && (
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Renvoyer l'invitation"
                    onClick={async () => {
                      const res = await market.teamAction({ action: "renew", id: m.id });
                      if (!res.ok) {
                        toast.error(res.message);
                        return;
                      }
                      showLink(res);
                      toast.success(
                        res.emailed ? "Invitation renvoyée" : "Nouveau lien créé · copiez-le",
                      );
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <ConfirmDialog
                  trigger={
                    <Button size="icon" variant="outline" aria-label={`Retirer ${m.email}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title={m.status === "invited" ? "Annuler l'invitation ?" : "Retirer ce membre ?"}
                  description={
                    m.status === "invited"
                      ? `Le lien envoyé à ${m.email} ne fonctionnera plus.`
                      : `${m.email} perdra immédiatement l'accès à votre espace.`
                  }
                  destructive
                  confirmLabel={m.status === "invited" ? "Annuler l'invitation" : "Retirer"}
                  onConfirm={async () => {
                    const res = await market.teamAction({ action: "remove", id: m.id });
                    if (!res.ok) toast.error(res.message);
                    else
                      toast.success(
                        m.status === "invited" ? "Invitation annulée" : "Membre retiré",
                      );
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {activity.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Actions récentes de l'équipe</h3>
          </div>
          <ul className="space-y-1.5 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-medium">{a.memberName}</span> · {a.action}
                </span>
                <span className="text-xs text-muted-foreground">{relativeTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
