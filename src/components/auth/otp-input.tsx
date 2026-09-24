import { useRef } from "react";

/**
 * Saisie d'un code à usage unique, une case par chiffre.
 * - coller un code entier (depuis un SMS ou un email) remplit toutes les cases ;
 * - `autocomplete="one-time-code"` permet au téléphone de proposer le code reçu par SMS ;
 * - chaque case est nommée pour les lecteurs d'écran.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fillFrom = (start: number, digits: string) => {
    const arr = value.padEnd(length, " ").split("");
    for (let k = 0; k < digits.length && start + k < length; k++) arr[start + k] = digits[k];
    onChange(arr.join("").trimEnd());
    refs.current[Math.min(start + digits.length, length - 1)]?.focus();
  };

  const set = (i: number, raw: string) => {
    let digits = raw.replace(/\D/g, "");
    if (raw && !digits) return;
    // Case déjà remplie : le nouveau chiffre remplace l'ancien.
    const current = value[i]?.trim();
    if (current && digits.length === 2) digits = digits.startsWith(current) ? digits[1] : digits[0];
    if (digits.length > 1) {
      // Saisie automatique du téléphone ou collage : plusieurs chiffres d'un coup.
      fillFrom(digits.length >= length ? 0 : i, digits.slice(0, length));
      return;
    }
    const arr = value.padEnd(length, " ").split("");
    arr[i] = digits || " ";
    onChange(arr.join("").trimEnd());
    if (digits && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex gap-2 justify-between" role="group" aria-label="Code de vérification">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${i + 1} sur ${length}`}
          value={value[i]?.trim() || ""}
          onChange={(e) => set(i, e.target.value)}
          onPaste={(e) => {
            const digits = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!digits) return;
            e.preventDefault();
            fillFrom(digits.length >= length ? 0 : i, digits.slice(0, length));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-14 w-12 rounded-xl glass text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ))}
    </div>
  );
}
