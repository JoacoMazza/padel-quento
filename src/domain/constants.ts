/** Cantidad de jugadores que completan un partido de pádel. */
export const OPEN_MATCH_MAX_PLAYERS = 4;

/**
 * Antelación mínima, en horas, para crear un partido abierto. Por debajo de este
 * umbral no alcanzaría tiempo para sumar jugadores, así que solo se permiten
 * reservas completas. El mismo umbral usa el proceso que cancela automáticamente
 * los partidos abiertos que no llegaron a completar el cupo.
 */
export const OPEN_MATCH_MIN_HOURS_BEFORE_START = 3;
