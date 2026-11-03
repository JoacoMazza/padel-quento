/** Cantidad de jugadores que completan un partido de pádel. */
export const OPEN_MATCH_MAX_PLAYERS = 4;

/**
 * Clave del advisory lock (pg_advisory_xact_lock(clase, bookingId)) que serializa
 * las altas de jugadores en un mismo partido, para no pasarse del cupo máximo.
 * Namespace distinto (forma de dos claves) al lock por cancha de las reservas,
 * para que un bookingId nunca contienda con un courtId que tenga el mismo número.
 */
export const JOIN_MATCH_LOCK_CLASS = 42;

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
 * a él (RN-04). El saldo nunca baja de 0 (ver recordPointsMovement).
 */
export const PENALTY_POINTS = 20;

/** Largo máximo, en caracteres, de un mensaje de chat (sin contar espacios de los extremos). */
export const CHAT_MESSAGE_MAX_LENGTH = 500;

/** Puntos de fidelidad que se acreditan por asistir a un turno reservado. */
export const ATTENDANCE_POINTS = 10;

/**
 * Puntos extra que recibe un jugador por sumarse al partido abierto de otro
 * usuario y asistir, para incentivar el armado colaborativo de partidos.
 */
export const OPEN_MATCH_JOIN_BONUS_POINTS = 5;

/**
 * Puntos que se le descuentan a un jugador por cada aspecto negativo (mala
 * actitud, llegar tarde, nivel distinto a su categoría) de una reseña recibida
 * tras un partido abierto (issue #73). El saldo nunca baja de 0 (ver recordPointsMovement).
 */
export const NEGATIVE_REVIEW_POINTS = 5;

/** Horas que tienen los jugadores para calificar a sus compañeros desde que termina el partido (HU-36). */
export const REVIEW_WINDOW_HOURS = 48;

/** Reseñas mínimas para mostrar la reputación de un jugador: una sola no alcanza para marcarlo. */
export const REPUTATION_MIN_REVIEWS = 3;

/** Por debajo de este porcentaje, la ficha del admin marca una alerta de reputación. */
export const REPUTATION_ALERT_PCT = 70;

/** Largo máximo, en caracteres, del comentario de una reseña (HU-36). */
export const REVIEW_COMMENT_MAX_LENGTH = 500;

/**
 * Días hacia adelante (unos 6 meses) que quedan reservados los turnos fijos
 * (HU-41). Un proceso en segundo plano va generando las fechas nuevas.
 */
export const FIXED_BOOKING_HORIZON_DAYS = 182;

/** Turnos pasados que se muestran en Mis turnos, los más recientes (issue #68). */
export const MY_BOOKINGS_PAST_LIMIT = 3;

/** Cupo de alumnos que el profesor puede fijar para un turno de clase (HU-43). */
export const MIN_CLASS_CAPACITY = 1;
export const MAX_CLASS_CAPACITY = 8;

/** Días hacia atrás de las clases terminadas que la agenda del profesor muestra como "Finalizado" (HU-46). */
export const FINISHED_CLASSES_DAYS = 7;
