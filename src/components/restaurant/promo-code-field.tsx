import { useState } from "react";
import { computePromoDiscount, findPromoCode } from "@/lib/promo-codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PromoCodeFieldProps {
  /** Faux dès que le restaurant a déjà une commande (codes « première commande »). */
  isFirstOrder?: boolean;
  subtotal: number;
  deliveryFee: number;
  appliedCode: string | null;
  discount: number;
  onApply: (code: string | null, discount: number) => void;
  className?: string;
}

export function PromoCodeField({
  isFirstOrder = true,
  subtotal,
  deliveryFee,
  appliedCode,
  discount,
  onApply,
  className,
}: PromoCodeFieldProps) {
  const [input, setInput] = useState(appliedCode ?? "");
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const promo = findPromoCode(input);
    if (!promo) {
      setError("Code invalide ou expiré");
      onApply(null, 0);
      return;
    }
    if (promo.firstOrderOnly && !isFirstOrder) {
      setError("Ce code est réservé à la première commande");
      onApply(null, 0);
      return;
    }
    const amount = computePromoDiscount(promo, subtotal, deliveryFee);
    if (amount <= 0) {
      setError(`Montant minimum : commande de ${promo.minSubtotal?.toLocaleString("fr-FR")} FCFA`);
      onApply(null, 0);
      return;
    }
    setError(null);
    onApply(promo.code, amount);
  };

  const clear = () => {
    setInput("");
    setError(null);
    onApply(null, 0);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="Code promo"
          aria-label="Code promo"
        />
        {appliedCode ? (
          <Button type="button" variant="outline" onClick={clear}>
            Retirer
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={apply}>
            Appliquer
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {appliedCode && discount > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {appliedCode} appliqué · −{discount.toLocaleString("fr-FR")} FCFA
        </p>
      )}
    </div>
  );
}
