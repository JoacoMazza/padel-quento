export enum Role {
  ADMIN = "admin",
  PLAYER = "player",
}

/**
 * Nivel de un administrador: el dueño del complejo, que además maneja el
 * equipo, los precios, las canchas y las métricas, o un trabajador.
 */
export enum AdminAccessLevel {
  OWNER = "owner",
  STAFF = "staff",
}

export enum PlayerCategory {
  FIRST = "1st",
  SECOND = "2nd",
  THIRD = "3rd",
  FOURTH = "4th",
  FIFTH = "5th",
  SIXTH = "6th",
  SEVENTH = "7th",
  WITHOUT_CATEGORY = "without_category",
}

/** Una cancha está disponible o dada de baja; los bloqueos temporales son fuera de servicio (OutOfService). */
export enum CourtState {
  AVAILABLE = "available",
  CLOSED_DOWN = "closed_down",
}

export enum DayOfWeek {
  MONDAY = "monday",
  TUESDAY = "tuesday",
  WEDNESDAY = "wednesday",
  THURSDAY = "thursday",
  FRIDAY = "friday",
  SATURDAY = "saturday",
  SUNDAY = "sunday",
}

export enum OutOfServiceReason {
  MAINTENANCE = "maintenance",
  FREE_DAY = "free_day",
  CLEANING = "cleaning",
  OTHER = "other",
}

/** Cómo vio un compañero el nivel del jugador respecto de la categoría que declaró (HU-36). */
export enum ReviewLevel {
  LOWER = "lower",
  AS_DECLARED = "as_declared",
  HIGHER = "higher",
}

export enum FixedBookingFrequency {
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly",
}

/**
 * Estado de cada fecha de un turno fijo: reservada (tiene su turno), liberada
 * por el admin solo para esa fecha, o salteada porque al generarla el horario
 * ya estaba ocupado.
 */
export enum FixedBookingDateState {
  BOOKED = "booked",
  RELEASED = "released",
  CONFLICT = "conflict",
}

/**
 * Un turno está reservado hasta que termina (el job de asistencia lo pasa a
 * finalizado) o hasta que se cancela. Si se pagó va aparte (Booking.isPaid).
 */
export enum BookingState {
  RESERVED = "reserved",
  FINISHED = "finished",
  CANCELLED = "cancelled",
}