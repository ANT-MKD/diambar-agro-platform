export function passwordScore(p: string): 0 | 1 | 2 | 3 {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 3) as 0 | 1 | 2 | 3;
}

export function PasswordStrength({ value }: { value: string }) {
  const s = passwordScore(value);
  const labels = ["", "Faible", "Moyen", "Fort"];
  const colors = ["bg-muted", "bg-destructive", "bg-amber-500", "bg-emerald-500"];
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= s ? colors[s] : "bg-muted"}`} />
        ))}
      </div>
      {value && (
        <p className="mt-1 text-xs text-muted-foreground">
          Force : <span className="font-semibold text-foreground">{labels[s]}</span>
        </p>
      )}
    </div>
  );
}
