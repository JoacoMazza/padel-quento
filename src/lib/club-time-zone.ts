/** Zona horaria del complejo (City Bell, La Plata). */
export const CLUB_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * El servidor arma las fechas de los turnos con la hora local (por ejemplo, las
 * de un turno fijo, ver src/domain/fixed-booking.ts): fija la zona del proceso
 * en la del club para que no dependa de dónde esté desplegado.
 */
export function applyClubTimeZone() {
  process.env.TZ = CLUB_TIME_ZONE;
}
