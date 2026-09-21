/**
 * Una sala de chat se cierra sola al finalizar el horario del turno (inicio +
 * duración): desde ese momento queda en solo lectura. Se deriva de la hora del
 * turno en vez de guardarse, así no depende de que corra ningún proceso en
 * segundo plano y el cierre es exacto.
 */
export function isChatClosed(
  booking: { fromDateTime: Date; durationMinutes: number },
  now: Date = new Date(),
): boolean {
  const endsAt = booking.fromDateTime.getTime() + booking.durationMinutes * 60_000;
  return now.getTime() >= endsAt;
}
