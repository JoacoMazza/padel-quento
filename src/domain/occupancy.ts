import { DayOfWeek } from "@/src/domain/enums";
// Misma duración de turno que la grilla de reservas y la turnera.
import { SLOT_DURATION_MINUTES } from "@/app/bookings/slot-utils";

export type OccupancyInput = {
  /** Primer y último día del rango (inclusive); solo importa la fecha. */
  from: Date;
  to: Date;
  courts: Array<{ id: number; number: number }>;
  schedules: Array<{ courtId: number; dayOfWeek: DayOfWeek; openingTime: string; closingTime: string }>;
  /** Solo turnos activos (reservados o pagos): los cancelados no ocupan la cancha. */
  bookings: Array<{ courtId: number; fromDateTime: Date; durationMinutes: number }>;
  outOfServices: Array<{ courtId: number; fromDateTime: Date; toDateTime: Date }>;
};

export type OccupancyStat = {
  bookedMinutes: number;
  availableMinutes: number;
  /** bookedMinutes / availableMinutes, entre 0 y 1 (0 si no hay nada disponible). */
  occupancy: number;
};

export type OccupancyMetrics = {
  total: OccupancyStat & { bookingsCount: number };
  byCourt: Array<OccupancyStat & { courtId: number; courtNumber: number }>;
  byDayOfWeek: Array<OccupancyStat & { dayOfWeek: DayOfWeek }>;
  /** Por turno, identificado por su hora de inicio en minutos desde las 00:00. */
  bySlot: Array<OccupancyStat & { startMinutes: number }>;
  byDayAndSlot: Array<OccupancyStat & { dayOfWeek: DayOfWeek; startMinutes: number }>;
};

/** Orden en que se muestran los días: la semana arranca el lunes. */
export const WEEK_DAYS: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

// Date.getDay(): 0 = domingo.
const DAY_OF_WEEK_BY_INDEX: DayOfWeek[] = [DayOfWeek.SUNDAY, ...WEEK_DAYS.slice(0, 6)];

type Counter = { booked: number; available: number };

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlapMinutes(start: number, end: number, otherStart: number, otherEnd: number): number {
  return Math.max(0, Math.min(end, otherEnd) - Math.max(start, otherStart)) / 60_000;
}

function toStat({ booked, available }: Counter): OccupancyStat {
  return { bookedMinutes: booked, availableMinutes: available, occupancy: available > 0 ? booked / available : 0 };
}

function add(counters: Map<string, Counter>, key: string, booked: number, available: number) {
  const counter = counters.get(key) ?? { booked: 0, available: 0 };
  counter.booked += booked;
  counter.available += available;
  counters.set(key, counter);
}

/**
 * Ocupación del complejo en un rango de días: minutos reservados sobre minutos
 * disponibles. Se calcula sobre la grilla de turnos de cada día (turnos de
 * SLOT_DURATION_MINUTES desde la apertura más temprana, como la turnera): lo
 * disponible es la parte de cada turno en que la cancha está abierta, menos sus
 * bloqueos (OutOfService), y de cada reserva solo cuenta la parte dentro de eso.
 * Se agrupa por cancha, día de la semana y turno. Usa la hora local.
 */
export function computeOccupancyMetrics(input: OccupancyInput): OccupancyMetrics {
  const firstDay = new Date(input.from.getFullYear(), input.from.getMonth(), input.from.getDate());
  const lastDay = new Date(input.to.getFullYear(), input.to.getMonth(), input.to.getDate());
  const rangeEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1).getTime();
  const courtIds = new Set(input.courts.map((c) => c.id));

  const bookings = input.bookings
    .filter((b) => courtIds.has(b.courtId))
    .filter((b) => b.fromDateTime.getTime() >= firstDay.getTime() && b.fromDateTime.getTime() < rangeEnd)
    .map((b) => ({
      courtId: b.courtId,
      start: b.fromDateTime.getTime(),
      end: b.fromDateTime.getTime() + b.durationMinutes * 60_000,
    }));
  const outOfServices = input.outOfServices.map((o) => ({
    courtId: o.courtId,
    start: o.fromDateTime.getTime(),
    end: o.toDateTime.getTime(),
  }));

  const total: Counter = { booked: 0, available: 0 };
  const byCourt = new Map<string, Counter>();
  const byDay = new Map<string, Counter>();
  const bySlot = new Map<string, Counter>();
  const byDayAndSlot = new Map<string, Counter>();

  for (let day = firstDay; day.getTime() <= lastDay.getTime(); day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const dayOfWeek = DAY_OF_WEEK_BY_INDEX[day.getDay()];
    const daySchedules = input.schedules.filter((s) => s.dayOfWeek === dayOfWeek && courtIds.has(s.courtId));
    if (daySchedules.length === 0) continue;

    const earliestOpen = Math.min(...daySchedules.map((s) => timeToMinutes(s.openingTime)));
    const latestClose = Math.max(...daySchedules.map((s) => timeToMinutes(s.closingTime)));
    const slotStarts: number[] = [];
    for (let slot = earliestOpen; slot + SLOT_DURATION_MINUTES <= latestClose; slot += SLOT_DURATION_MINUTES) {
      slotStarts.push(slot);
    }

    for (const schedule of daySchedules) {
      const open = timeToMinutes(schedule.openingTime);
      const close = timeToMinutes(schedule.closingTime);

      for (const slot of slotStarts) {
        // [start, end): la parte de este turno en que la cancha está abierta.
        const startMinutes = Math.max(open, slot);
        const endMinutes = Math.min(close, slot + SLOT_DURATION_MINUTES);
        if (endMinutes <= startMinutes) continue;
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, startMinutes).getTime();
        const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, endMinutes).getTime();

        const blocked = outOfServices
          .filter((o) => o.courtId === schedule.courtId)
          .reduce((sum, o) => sum + overlapMinutes(start, end, o.start, o.end), 0);
        const available = Math.max(0, (end - start) / 60_000 - blocked);
        const booked = Math.min(
          available,
          bookings
            .filter((b) => b.courtId === schedule.courtId)
            .reduce((sum, b) => sum + overlapMinutes(start, end, b.start, b.end), 0),
        );

        total.booked += booked;
        total.available += available;
        add(byCourt, String(schedule.courtId), booked, available);
        add(byDay, dayOfWeek, booked, available);
        add(bySlot, String(slot), booked, available);
        add(byDayAndSlot, `${dayOfWeek}-${slot}`, booked, available);
      }
    }
  }

  const empty: Counter = { booked: 0, available: 0 };
  const slots = [...bySlot.keys()].map(Number).sort((a, b) => a - b);

  return {
    total: { ...toStat(total), bookingsCount: bookings.length },
    byCourt: [...input.courts]
      .sort((a, b) => a.number - b.number)
      .map((court) => ({
        courtId: court.id,
        courtNumber: court.number,
        ...toStat(byCourt.get(String(court.id)) ?? empty),
      })),
    byDayOfWeek: WEEK_DAYS.map((dayOfWeek) => ({ dayOfWeek, ...toStat(byDay.get(dayOfWeek) ?? empty) })),
    bySlot: slots.map((startMinutes) => ({ startMinutes, ...toStat(bySlot.get(String(startMinutes))!) })),
    byDayAndSlot: WEEK_DAYS.flatMap((dayOfWeek) =>
      slots
        .filter((startMinutes) => byDayAndSlot.has(`${dayOfWeek}-${startMinutes}`))
        .map((startMinutes) => ({
          dayOfWeek,
          startMinutes,
          ...toStat(byDayAndSlot.get(`${dayOfWeek}-${startMinutes}`)!),
        })),
    ),
  };
}
