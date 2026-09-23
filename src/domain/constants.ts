/** Cantidad de jugadores que completan un partido de pádel. */
export const OPEN_MATCH_MAX_PLAYERS = 4;

/**
 * Antelación mínima, en horas, para crear un partido abierto. Por debajo de este
 * umbral no alcanzaría tiempo para sumar jugadores, así que solo se permiten
 * reservas completas. El mismo umbral usa el proceso que cancela automáticamente
 * los partidos abiertos que no llegaron a completar el cupo.
 */
export const OPEN_MATCH_MIN_HOURS_BEFORE_START = 3;

/** Largo máximo, en caracteres, de un mensaje de chat (sin contar espacios de los extremos). */
export const CHAT_MESSAGE_MAX_LENGTH = 500;

/** Puntos de fidelidad que se acreditan por asistir a un turno reservado. */
export const ATTENDANCE_POINTS = 10;
