import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/data/store";
import { useUnits } from "@/data/units";
import { unitChoices, unitKey, unitProblem } from "@/lib/units";

const OTHER = "__autre__";

/** Unité de vente : une unité de la liste (base, déjà utilisées,
 * suggestions) ou une unité écrite par le producteur. Une unité écrite
 * autrement qu'une existante (« Sacs ») reprend celle-ci. */
export function UnitPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (unit: string) => void;
}) {
  const units = useUnits();
  const products = useProducts();
  const choices = unitChoices([
    ...units.map((u) => u.name),
    ...(units.length ? [] : products.map((p) => p.unit)),
  ]);
  const known = choices.find((u) => unitKey(u) === unitKey(value));
  const [writing, setWriting] = useState(!!value && !known);
  const [draft, setDraft] = useState(!known ? value : "");

  const twin = draft ? choices.find((u) => unitKey(u) === unitKey(draft)) : undefined;
  const problem = draft && !twin ? unitProblem(draft) : null;

  return (
    <div className="space-y-2" data-testid="unit-picker">
      <Select
        value={writing ? OTHER : (known ?? "")}
        onValueChange={(v) => {
          if (v === OTHER) {
            setWriting(true);
            onChange(draft);
          } else {
            setWriting(false);
            setDraft("");
            onChange(v);
          }
        }}
      >
        <SelectTrigger aria-label="Unité">
          <SelectValue placeholder="Choisir une unité" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>Autre unité…</SelectItem>
        </SelectContent>
      </Select>
      {writing && (
        <div className="space-y-1">
          <Input
            autoFocus
            value={draft}
            maxLength={20}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Ex. seau, carton, panier"
            aria-label="Autre unité"
          />
          {twin ? (
            <p className="text-xs text-muted-foreground">
              Cette unité existe déjà : « {twin} » sera utilisée.
            </p>
          ) : problem ? (
            <p className="text-xs text-destructive">{problem}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
