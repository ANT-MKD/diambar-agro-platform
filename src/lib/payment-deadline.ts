// Délai de paiement Wave / Orange Money pendant le pilote : sans paiement
// déclaré, la commande est annulée et son stock remis en vente.
//   - au plus tard la veille du créneau de livraison, à l'heure réglée par
//     l'admin (20 h par défaut) : le producteur doit savoir le soir s'il
//     prépare pour le lendemain matin ;
//   - et au plus tard 24 h après la commande, pour ne pas bloquer le stock
//     plusieurs jours sur une commande passée longtemps à l'avance ;
//   - jamais moins d'une heure après la commande.
// Heure du Sénégal = UTC, toute l'année.

const HOUR = 3600_000;

export function paymentDeadline(createdAt: Date, slotStart: Date, deadlineHour: number): Date {
  const eve = Date.UTC(
    slotStart.getUTCFullYear(),
    slotStart.getUTCMonth(),
    slotStart.getUTCDate() - 1,
    deadlineHour,
  );
  const byDay = createdAt.getTime() + 24 * HOUR;
  const floor = createdAt.getTime() + HOUR;
  return new Date(Math.max(floor, Math.min(eve, byDay)));
}

/** Le rappel part une heure avant l'annulation. */
export const PAYMENT_REMINDER_BEFORE_MS = HOUR;
