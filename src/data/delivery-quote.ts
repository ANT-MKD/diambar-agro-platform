import { useEffect, useMemo, useState } from "react";
import { quoteDeliveryFn, type DeliveryQuoteResult } from "@/lib/market/functions";

// Frais de livraison du panier calculés par le serveur (mode base), selon la
// distance de chaque producteur : affichés avant de payer, recalculés quand
// l'adresse ou le panier change.

export type DeliveryQuoteState = {
  loading: boolean;
  quote: Extract<DeliveryQuoteResult, { ok: true }> | null;
  error: string | null;
};

export function useDeliveryQuote(
  enabled: boolean,
  address: string,
  lines: { productId: string; qty: number }[],
): DeliveryQuoteState {
  const key = useMemo(() => JSON.stringify({ address: address.trim(), lines }), [address, lines]);
  const [state, setState] = useState<DeliveryQuoteState>({
    loading: false,
    quote: null,
    error: null,
  });
  useEffect(() => {
    if (!enabled) return;
    const { address: a, lines: l } = JSON.parse(key) as {
      address: string;
      lines: { productId: string; qty: number }[];
    };
    if (a.length < 3 || l.length === 0) {
      setState({ loading: false, quote: null, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const timer = window.setTimeout(() => {
      quoteDeliveryFn({ data: { deliveryAddress: a, lines: l } })
        .then((res) => {
          if (!alive) return;
          setState(
            res.ok
              ? { loading: false, quote: res, error: null }
              : { loading: false, quote: null, error: res.message },
          );
        })
        .catch(() => {
          if (alive) {
            setState({
              loading: false,
              quote: null,
              error: "Frais de livraison indisponibles : vérifiez votre connexion.",
            });
          }
        });
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [enabled, key]);
  return state;
}
