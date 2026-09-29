/** Cantidad de jugadores que completan un partido de pádel. */
export const OPEN_MATCH_MAX_PLAYERS = 4;

/**
 * Antelación mínima, en horas, para crear un partido abierto. Por debajo de este
 * umbral no alcanzaría tiempo para sumar jugadores, así que solo se permiten
 * reservas completas. El mismo umbral usa el proceso que cancela automáticamente
 * los partidos abiertos que no llegaron a completar el cupo.
 */
export const OPEN_MATCH_MIN_HOURS_BEFORE_START = 3;

/**
 * Antelación, en horas, por debajo de la cual cancelar un turno se considera
 * tardío y se penaliza (RN-03).
 */
export const LATE_CANCELLATION_HOURS = 3;

/**
 * Puntos que se descuentan por cancelar un turno tarde (RN-03) o por no asistir
 * a él (RN-04).
 */
export const PENALTY_POINTS = 10;

/** Largo máximo, en caracteres, de un mensaje de chat (sin contar espacios de los extremos). */
export const CHAT_MESSAGE_MAX_LENGTH = 500;

/** Puntos de fidelidad que se acreditan por asistir a un turno reservado. */
export const ATTENDANCE_POINTS = 10;

/**
 * Puntos extra que recibe un jugador por sumarse al partido abierto de otro
 * usuario y asistir, para incentivar el armado colaborativo de partidos.
 */
export const OPEN_MATCH_JOIN_BONUS_POINTS = 5;
