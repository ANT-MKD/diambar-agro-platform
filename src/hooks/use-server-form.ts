import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Formulaire initialisé depuis des données qui peuvent arriver ou changer
 * après l'affichage (compte chargé du serveur, rafraîchi régulièrement).
 * Tant que rien n'est modifié, le formulaire suit ces données ; une saisie
 * en cours n'est jamais écrasée.
 */
export function useServerForm<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const key = JSON.stringify(source);
  const [state, setState] = useState({ key, form: source });
  if (state.key !== key) {
    const current = JSON.stringify(state.form);
    // Pas de modification en cours (ou formulaire déjà égal aux nouvelles
    // données, après un enregistrement) : on suit.
    if (current === state.key || current === key) setState({ key, form: source });
  }
  const setForm: Dispatch<SetStateAction<T>> = (next) =>
    setState((s) => ({
      ...s,
      form: typeof next === "function" ? (next as (prev: T) => T)(s.form) : next,
    }));
  return [state.form, setForm];
}
