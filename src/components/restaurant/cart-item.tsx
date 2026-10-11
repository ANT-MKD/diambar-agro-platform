import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { cartActions } from "@/data/store";

export function CartItemRow({ product, qty }: { product: Product; qty: number }) {
  const subtotal = product.pricePerKg * qty;
  const atMax = qty >= product.stock;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <Link
        to="/restaurant/marketplace/$productId"
        params={{ productId: product.id }}
        className="shrink-0"
      >
        <img src={product.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{product.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {formatFCFA(product.pricePerKg)} / {product.unit}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-lg border border-border">
          <button
            onClick={() => cartActions.setQty(product.id, qty - 1)}
            className="h-10 w-10 grid place-items-center hover:bg-accent"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={product.stock}
            aria-label={`Quantité — ${product.name}`}
            value={qty}
            onChange={(e) => {
              const wanted = Math.floor(Number(e.target.value) || 0);
              if (wanted <= 0) return;
              const applied = cartActions.setQty(product.id, wanted);
              if (applied < wanted) {
                toast.error(`Stock disponible : ${product.stock} ${product.unit}`);
              }
            }}
            className="h-10 w-16 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => {
              if (atMax) {
                toast.error(`Stock maximum atteint (${product.stock} ${product.unit})`);
                return;
              }
              cartActions.setQty(product.id, qty + 1);
            }}
            disabled={atMax}
            className="h-10 w-10 grid place-items-center hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {atMax && (
          <div className="text-[10px] text-amber-500 mt-1">
            Stock maximum atteint ({product.stock} {product.unit})
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-display font-bold text-primary">{formatFCFA(subtotal)}</div>
        <button
          onClick={() => cartActions.remove(product.id)}
          className="mt-2 text-rose-500 hover:text-rose-600 inline-flex items-center gap-1 text-[11px]"
        >
          <Trash2 className="h-3 w-3" />
          Retirer
        </button>
      </div>
    </div>
  );
}
