import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/farmer/page-header";

export type SettingsNavItem = { to: string; label: string; icon: LucideIcon; group?: string };

export function SettingsShell({
  title,
  subtitle,
  items,
  children,
  statusStrip,
}: {
  title: string;
  subtitle: string;
  items: SettingsNavItem[];
  children: ReactNode;
  statusStrip?: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const groups = new Map<string | undefined, SettingsNavItem[]>();
  for (const it of items) {
    const arr = groups.get(it.group) ?? [];
    arr.push(it);
    groups.set(it.group, arr);
  }
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      {statusStrip}
      <div className="grid lg:grid-cols-[230px_1fr] gap-6">
        <aside className="glass rounded-2xl p-2 h-fit space-y-3 lg:sticky lg:top-20">
          {[...groups.entries()].map(([group, groupItems]) => (
            <div key={group ?? "_"} className="space-y-1">
              {group && (
                <div className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group}
                </div>
              )}
              {groupItems.map((it) => {
                const active = path === it.to;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <it.icon className="h-4 w-4" />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link
            to="/login"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            Se déconnecter
          </Link>
        </aside>
        <section className="min-w-0 space-y-6">{children}</section>
      </div>
    </div>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  onSave,
  saveLabel = "Enregistrer",
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => boolean | void;
  saveLabel?: string;
  footer?: ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const ok = onSave?.();
        if (ok === false) return;
        toast.success("Modifications enregistrées");
      }}
      className="glass rounded-2xl p-6 space-y-5"
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      <div className="flex justify-end gap-2">
        {footer}
        <Button type="submit">{saveLabel}</Button>
      </div>
    </form>
  );
}

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children ?? <Switch checked={!!checked} onCheckedChange={(v) => onChange?.(v)} />}
    </div>
  );
}
