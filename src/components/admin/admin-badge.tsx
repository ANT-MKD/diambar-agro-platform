const MAP: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Payé: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  needs_correction: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "En cours": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  investigating: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  removed: "bg-destructive/10 text-destructive border-destructive/20",
  Échec: "bg-destructive/10 text-destructive border-destructive/20",
};

const LABELS: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  needs_correction: "À revoir",
  suspended: "Suspendu",
  rejected: "Rejeté",
  approved: "Approuvé",
  removed: "Retiré",
  open: "Ouvert",
  investigating: "Instruction",
  resolved: "Résolu",
};

export function AdminBadge({ value, label }: { value: string; label?: string }) {
  const tone = MAP[value] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {label ?? LABELS[value] ?? value}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    farmer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    restaurant: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    driver: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    admin: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  };
  const labels: Record<string, string> = {
    farmer: "Agriculteur",
    restaurant: "Restaurant",
    driver: "Livreur",
    admin: "Admin",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${map[role] ?? "border-border"}`}
    >
      {labels[role] ?? role}
    </span>
  );
}
