import { useRef } from "react";

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
  const set = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const arr = value.padEnd(length, " ").split("");
    arr[i] = v || " ";
    onChange(arr.join("").trimEnd());
    if (v && i < length - 1) refs.current[i + 1]?.focus();
  };
  return (
    <div className="flex gap-2 justify-between">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-14 w-12 rounded-xl glass text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ))}
    </div>
  );
}
