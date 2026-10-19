/** Force d'un mot de passe, de 0 (vide ou trop court) à 3 (fort). */
export function passwordScore(p: string): 0 | 1 | 2 | 3 {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 3) as 0 | 1 | 2 | 3;
}
