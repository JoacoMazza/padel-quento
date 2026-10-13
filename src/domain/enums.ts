export enum Role {
  ADMIN = "admin",
  PLAYER = "player",
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

export enum CourtState {
  AVAILABLE = "available",
  OUT_OF_SERVICE = "out_of_service",
  MAINTENANCE = "maintenance",
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

export enum BookingState {
  RESERVED = "reserved",
  AVAILABLE = "available",
  PAID = "paid",
  CANCELLED = "cancelled",
}