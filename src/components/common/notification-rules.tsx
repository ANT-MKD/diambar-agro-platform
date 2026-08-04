import { useState } from "react";
import { Bell, Mail, MessageCircle, Smartphone, Zap, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

export const CHANNEL_DEFS = [
  { key: "inapp", label: "In-app", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "sms", label: "SMS", icon: Smartphone },
] as const;

export type ChannelKey = (typeof CHANNEL_DEFS)[number]["key"];
export type EventDef = { key: string; label: string; description?: string };
export type TriggerRule = { key: string; label: string; condition: string; channel: string; firedThisMonth: number };

type Matrix = Record<string, Record<ChannelKey, boolean>>;

export function buildMatrix(events: readonly EventDef[], defaults: Partial<Record<ChannelKey, boolean>> = {}): Matrix {
  const base = { inapp: true, email: true, whatsapp: false, sms: false, ...defaults } as Record<ChannelKey, boolean>;
  return Object.fromEntries(events.map((e) => [e.key, { ...base }])) as Matrix;
}

/** Matrice événements × canaux (in-app, email, WhatsApp, SMS). */
export function ChannelMatrix({ events, initial }: { events: readonly EventDef[]; initial?: Matrix }) {
  const [matrix, setMatrix] = useState<Matrix>(initial ?? buildMatrix(events));

  const toggle = (evt: string, ch: ChannelKey) =>
    setMatrix((m) => ({ ...m, [evt]: { ...m[evt], [ch]: !m[evt][ch] } }));

  const toggleColumn = (ch: ChannelKey) => {
    const allOn = events.every((e) => matrix[e.key]?.[ch]);
    setMatrix((m) => Object.fromEntries(events.map((e) => [e.key, { ...m[e.key], [ch]: !allOn }])) as Matrix);
  };

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Événement</th>
            {CHANNEL_DEFS.map((c) => (
              <th key={c.key} className="py-2 w-24">
                <button
                  type="button"
                  onClick={() => toggleColumn(c.key)}
                  className="mx-auto flex flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.key} className="border-b border-border last:border-0">
              <td className="py-3 pr-3">
                <div className="font-medium text-sm">{e.label}</div>
                {e.description && <div className="text-xs text-muted-foreground">{e.description}</div>}
              </td>
              {CHANNEL_DEFS.map((c) => (
                <td key={c.key} className="py-3 text-center">
                  <button
                    type="button"
                    aria-label={`${e.label} via ${c.label}`}
                    aria-pressed={matrix[e.key]?.[c.key] ?? false}
                    onClick={() => toggle(e.key, c.key)}
                    className={`h-6 w-6 rounded-md border grid place-items-center transition ${
                      matrix[e.key]?.[c.key]
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border hover:bg-accent text-transparent"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Règles de déclenchement mockées + heures calmes + regroupement. */
export function TriggerRules({ rules }: { rules: readonly TriggerRule[] }) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(rules.map((r) => [r.key, true])),
  );
  const [quietHours, setQuietHours] = useState(true);
  const [digest, setDigest] = useState([15]);

  return (
    <div className="space-y-3">
      {rules.map((r) => (
        <div key={r.key} className="rounded-xl border border-border p-3 flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{r.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">SI</span> {r.condition} <span className="font-mono">ALORS</span> {r.channel}
            </div>
            <div className="text-[10px] text-muted-foreground/70 mt-1">Déclenchée {r.firedThisMonth} fois ce mois-ci</div>
          </div>
          <Switch checked={enabled[r.key]} onCheckedChange={(v) => setEnabled({ ...enabled, [r.key]: v })} />
        </div>
      ))}

      <div className="rounded-xl border border-border p-3 flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Heures calmes (22h – 06h)</div>
          <div className="text-xs text-muted-foreground">Les alertes non critiques sont mises en file et envoyées le matin.</div>
        </div>
        <Switch checked={quietHours} onCheckedChange={setQuietHours} />
      </div>

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Regroupement des alertes</div>
            <div className="text-xs text-muted-foreground">Fusionne les notifications similaires sur une fenêtre glissante.</div>
          </div>
          <span className="font-mono text-sm font-semibold text-primary">{digest[0]} min</span>
        </div>
        <Slider className="mt-3" value={digest} onValueChange={setDigest} min={0} max={60} step={5} />
      </div>
    </div>
  );
}