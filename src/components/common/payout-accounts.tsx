import { toast } from "sonner";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { market } from "@/data/market-remote";
import { useMyAccount } from "@/data/store";
import { useServerForm } from "@/hooks/use-server-form";

// Numéros qui reçoivent les retraits (mode base) : enregistrés avec le compte
// et utilisés par défaut à chaque demande de retrait.

export function PayoutAccountsBase() {
  const account = useMyAccount();
  const payout = account?.preferences.payout;
  const [form, setForm] = useServerForm({
    wave: payout?.wave ?? "",
    orangeMoney: payout?.orangeMoney ?? "",
    primary: payout?.primary ?? "wave",
  });

  const save = async () => {
    const res = await market.savePreferences({ payout: form });
    if (!res.ok) {
      toast.error(res.message);
      return false;
    }
    return true;
  };

  return (
    <SettingsCard
      title="Comptes de retrait"
      description="L'argent de vos retraits est envoyé sur ces numéros. Tout changement est inscrit au journal de sécurité."
      onSave={save}
    >
      <FieldRow label="Wave">
        <Input
          inputMode="tel"
          value={form.wave}
          onChange={(e) => setForm({ ...form, wave: e.target.value })}
          placeholder="77 123 45 67"
        />
      </FieldRow>
      <FieldRow label="Orange Money">
        <Input
          inputMode="tel"
          value={form.orangeMoney}
          onChange={(e) => setForm({ ...form, orangeMoney: e.target.value })}
          placeholder="77 123 45 67"
        />
      </FieldRow>
      <FieldRow label="Moyen par défaut" hint="Présélectionné lors d'une demande de retrait.">
        <Select
          value={form.primary}
          onValueChange={(v) => setForm({ ...form, primary: v as "wave" | "orange_money" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wave">Wave</SelectItem>
            <SelectItem value="orange_money">Orange Money</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
    </SettingsCard>
  );
}
