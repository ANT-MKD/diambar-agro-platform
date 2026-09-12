import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export const Route = createFileRoute("/farmer/settings/team")({
  head: () => ({
    meta: [
      { title: "Équipe · Paramètres agriculteur · Diambar Agro" },
      {
        name: "description",
        content: "Invitez vos collaborateurs et gérez leurs rôles sur votre exploitation.",
      },
      { property: "og:title", content: "Équipe · Paramètres agriculteur" },
      { property: "og:description", content: "Gérez les accès de votre équipe agricole." },
    ],
  }),
  component: TeamSettings,
});

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "invited";
};

const ROLES = [
  { value: "owner", label: "Propriétaire" },
  { value: "manager", label: "Gestionnaire" },
  { value: "stock", label: "Responsable stock" },
  { value: "viewer", label: "Lecture seule" },
];

function TeamSettings() {
  const [members, setMembers] = useState<Member[]>([
    {
      id: "t1",
      name: "Mamadou Diallo",
      email: "mamadou@diallo-farm.sn",
      role: "owner",
      status: "active",
    },
    { id: "t2", name: "Awa Ndiaye", email: "awa@diallo-farm.sn", role: "stock", status: "active" },
    { id: "t3", name: "—", email: "ibrahima@diallo-farm.sn", role: "viewer", status: "invited" },
  ]);
  const [invite, setInvite] = useState({ email: "", role: "viewer" });

  const sendInvite = () => {
    if (!/^\S+@\S+\.\S+$/.test(invite.email)) {
      toast.error("Email invalide");
      return false;
    }
    setMembers((m) => [
      ...m,
      {
        id: `t_${Date.now()}`,
        name: "—",
        email: invite.email,
        role: invite.role,
        status: "invited",
      },
    ]);
    setInvite({ email: "", role: "viewer" });
    return true;
  };

  return (
    <>
      <SettingsCard
        title="Inviter un collaborateur"
        description="L'invitation est envoyée par email et expire après 7 jours."
        onSave={sendInvite}
        saveLabel="Envoyer l'invitation"
      >
        <div className="grid sm:grid-cols-[1fr_200px] gap-4">
          <FieldRow label="Email">
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
                {ROLES.filter((r) => r.value !== "owner").map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Membres ({members.length})</h3>
        </div>
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
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
              {m.status === "invited" && (
                <span className="text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5">
                  Invitation envoyée
                </span>
              )}
              <Select
                value={m.role}
                onValueChange={(v) => {
                  setMembers((arr) => arr.map((x) => (x.id === m.id ? { ...x, role: v } : x)));
                  toast.success("Rôle mis à jour");
                }}
                disabled={m.role === "owner"}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {m.role !== "owner" && (
                <ConfirmDialog
                  trigger={
                    <Button size="icon" variant="outline">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="Retirer ce membre ?"
                  description={`${m.email} perdra immédiatement l'accès à votre exploitation.`}
                  destructive
                  confirmLabel="Retirer"
                  onConfirm={() => {
                    setMembers((arr) => arr.filter((x) => x.id !== m.id));
                    toast.success("Membre retiré");
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
