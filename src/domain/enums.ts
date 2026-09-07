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

export enum BookingState {
  RESERVED = "reserved",
  AVAILABLE = "available",
  PAID = "paid",
  CANCELLED = "cancelled",
  PENDING_PLAYERS = "pending_players",
}