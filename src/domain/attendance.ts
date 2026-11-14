/** Motivos de los movimientos de puntos que origina la asistencia a un turno (penalties.reason). */
export const ATTENDANCE_POINTS_REASON = "Asistencia a turno reservado";
export const OPEN_MATCH_JOIN_BONUS_REASON = "Bonus por sumarse a un partido abierto";
export const NO_SHOW_PENALTY_REASON = "Inasistencia a turno reservado";

/**
 * En un turno sin partido abierto, quien reservó asistió salvo que el
 * administrador le haya marcado la inasistencia (una penalización ligada al turno).
 */
export function bookerAttended(booking: { penalties?: { reason: string }[] }): boolean {
  return !(booking.penalties ?? []).some((penalty) => penalty.reason === NO_SHOW_PENALTY_REASON);
}

/** El jugador de un partido abierto estuvo: asistió al menos uno de su grupo (los ausentes son sus acompañantes). */
export function isPresent(matchPlayer: { attendedCount: number }): boolean {
  return matchPlayer.attendedCount > 0;
}

/** Faltó alguien del grupo del jugador: él mismo o alguno de los que sumó. */
export function hasNoShow(matchPlayer: { attendedCount: number; playersCount: number }): boolean {
  return matchPlayer.attendedCount < matchPlayer.playersCount;
}
