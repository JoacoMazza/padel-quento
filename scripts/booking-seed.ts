import { BookingState, DayOfWeek } from "@/src/domain/enums";
import { SLOT_DURATION_MINUTES } from "@/app/bookings/slot-utils";

export type GenerateSeedBookingsInput = {
  /** Momento de ejecución: los turnos se generan alrededor de esta fecha. */
  now: Date;
  courts: Array<{ id: number; price: number }>;
  schedules: Array<{ courtId: number; dayOfWeek: DayOfWeek; openingTime: string; closingTime: string }>;
  playerIds: number[];
  /** Turnos activos ya cargados: los días que tienen alguno no se tocan. */
  existing: Array<{ courtId: number; fromDateTime: Date; durationMinutes: number }>;
  pastDays?: number;
  futureDays?: number;
  /** Semilla del generador pseudoaleatorio: mismos datos y semilla, mismos turnos. */
  seed?: number;
};

export type SeedBooking = {
  courtId: number;
  bookerId: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  price: number;
  attended: boolean;
  pointsAwarded: boolean;
};

// Date.getDay(): 0 = domingo.
const DAY_OF_WEEK_BY_INDEX: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

const CANCELLED_RATE = 0.08;
const NO_SHOW_RATE = 0.06;
const MAX_DEMAND = 0.95;

/** Generador pseudoaleatorio con semilla (mulberry32). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Probabilidad de que un turno esté reservado: pico a la tarde-noche y los fines de semana. */
function slotDemand(startMinutes: number, isWeekend: boolean): number {
  const hour = startMinutes / 60;
  const base = hour < 12 ? 0.2 : hour < 17 ? 0.3 : hour < 21 ? 0.75 : 0.5;
  return base + (isWeekend ? (hour < 17 ? 0.25 : 0.1) : 0);
}

/**
 * Turnos de ejemplo para revisar las métricas de ocupación: desde pastDays
 * antes hasta futureDays después de `now`, en la grilla de turnos de cada
 * cancha. Solo completa los días sin turnos cargados, así que correrlo de nuevo
 * no agrega turnos (salvo en los días nuevos, si cambió la fecha). Los pasados
 * quedan pagos (con algunas inasistencias) o cancelados, con los puntos ya
 * procesados para que el job de asistencia no los tome; los futuros quedan
 * reservados, con menos demanda cuanto más lejos están.
 */
export function generateSeedBookings({
  now,
  courts,
  schedules,
  playerIds,
  existing,
  pastDays = 90,
  futureDays = 30,
  seed = 42,
}: GenerateSeedBookingsInput): SeedBooking[] {
  if (playerIds.length === 0) return [];
  const random = seededRandom(seed);
  const sortedCourts = [...courts].sort((a, b) => a.id - b.id);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const generated: SeedBooking[] = [];
  const daysWithBookings = new Set(existing.map((e) => e.fromDateTime.toDateString()));

  for (let offset = -pastDays; offset <= futureDays; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    if (daysWithBookings.has(day.toDateString())) continue;
    const dayOfWeek = DAY_OF_WEEK_BY_INDEX[day.getDay()];
    const isWeekend = dayOfWeek === DayOfWeek.SATURDAY || dayOfWeek === DayOfWeek.SUNDAY;
    // Las reservas futuras todavía se están llenando: cuanto más lejos, menos.
    const fillFactor = offset > 0 ? 1 - (0.7 * offset) / futureDays : 1;

    sortedCourts.forEach((court, index) => {
      const schedule = schedules.find((s) => s.courtId === court.id && s.dayOfWeek === dayOfWeek);
      if (!schedule) return;
      // Las primeras canchas son un poco más pedidas que las últimas.
      const courtFactor = 1 - index * 0.04;
      const close = timeToMinutes(schedule.closingTime);

      for (
        let slot = timeToMinutes(schedule.openingTime);
        slot + SLOT_DURATION_MINUTES <= close;
        slot += SLOT_DURATION_MINUTES
      ) {
        const fromDateTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, slot);
        const start = fromDateTime.getTime();
        const demand = Math.min(MAX_DEMAND, slotDemand(slot, isWeekend) * courtFactor * fillFactor);
        if (random() >= demand) continue;

        const bookerId = playerIds[Math.floor(random() * playerIds.length)];
        const isPast = start < now.getTime();
        const outcome = random();
        generated.push({
          courtId: court.id,
          bookerId,
          fromDateTime,
          durationMinutes: SLOT_DURATION_MINUTES,
          bookingState: !isPast
            ? BookingState.RESERVED
            : outcome < CANCELLED_RATE
              ? BookingState.CANCELLED
              : BookingState.PAID,
          price: court.price,
          attended: !isPast || outcome >= CANCELLED_RATE + NO_SHOW_RATE,
          pointsAwarded: isPast,
        });
      }
    });
  }

  return generated;
}
