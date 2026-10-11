import { describe, expect, it } from "vitest";
import { BookingState, DayOfWeek } from "@/src/domain/enums";
import { generateSeedBookings, type GenerateSeedBookingsInput } from "@/scripts/booking-seed";

const ALL_DAYS = Object.values(DayOfWeek);
const now = new Date(2026, 9, 12, 15, 0);

function input(overrides: Partial<GenerateSeedBookingsInput> = {}): GenerateSeedBookingsInput {
  const courts = [1, 2, 3, 4].map((id) => ({ id, price: 10000 + id }));
  return {
    now,
    courts,
    // Como el seed base: de 09:00 a 23:00 todos los días.
    schedules: courts.flatMap((court) =>
      ALL_DAYS.map((dayOfWeek) => ({ courtId: court.id, dayOfWeek, openingTime: "09:00:00", closingTime: "23:00:00" })),
    ),
    playerIds: [100, 200, 300],
    existing: [],
    ...overrides,
  };
}

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const SLOT_STARTS = [540, 630, 720, 810, 900, 990, 1080, 1170, 1260]; // 9:00, 10:30, ... 21:00

describe("generateSeedBookings", () => {
  it("genera turnos desde 90 días antes hasta 30 días después de la fecha de ejecución", () => {
    const bookings = generateSeedBookings(input());

    const first = new Date(2026, 9, 12 - 90);
    const afterLast = new Date(2026, 9, 12 + 31);
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((b) => b.fromDateTime >= first && b.fromDateTime < afterLast)).toBe(true);
    expect(bookings.some((b) => b.fromDateTime < now)).toBe(true);
    expect(bookings.some((b) => b.fromDateTime > now)).toBe(true);
  });

  it("cambia las fechas según el momento en que se ejecuta", () => {
    const later = new Date(2026, 11, 1, 15, 0);
    const bookings = generateSeedBookings(input({ now: later }));

    expect(bookings.every((b) => b.fromDateTime >= new Date(2026, 11, 1 - 90))).toBe(true);
    expect(bookings.some((b) => b.fromDateTime > new Date(2026, 11, 20))).toBe(true);
  });

  it("ubica los turnos en la grilla de 90 minutos desde la apertura de cada cancha", () => {
    const bookings = generateSeedBookings(input());

    expect(bookings.every((b) => SLOT_STARTS.includes(minutesOfDay(b.fromDateTime)))).toBe(true);
    expect(bookings.every((b) => b.durationMinutes === 90)).toBe(true);
  });

  it("solo genera turnos en canchas y días con horario", () => {
    const bookings = generateSeedBookings(
      input({ schedules: [{ courtId: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "09:00:00", closingTime: "23:00:00" }] }),
    );

    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings.every((b) => b.courtId === 1 && b.fromDateTime.getDay() === 1)).toBe(true);
  });

  it("los turnos pasados quedan pagos o cancelados y con los puntos ya procesados; los futuros, reservados", () => {
    const bookings = generateSeedBookings(input());
    const past = bookings.filter((b) => b.fromDateTime < now);
    const future = bookings.filter((b) => b.fromDateTime >= now);

    expect(past.every((b) => [BookingState.PAID, BookingState.CANCELLED].includes(b.bookingState))).toBe(true);
    expect(past.some((b) => b.bookingState === BookingState.CANCELLED)).toBe(true);
    expect(past.some((b) => !b.attended)).toBe(true);
    expect(past.every((b) => b.pointsAwarded)).toBe(true);
    expect(future.every((b) => b.bookingState === BookingState.RESERVED && b.attended && !b.pointsAwarded)).toBe(true);
  });

  it("concentra más demanda a la tarde-noche que a la mañana", () => {
    const bookings = generateSeedBookings(input()).filter((b) => b.bookingState !== BookingState.CANCELLED);
    const at = (minutes: number) => bookings.filter((b) => minutesOfDay(b.fromDateTime) === minutes).length;

    expect(at(19 * 60 + 30)).toBeGreaterThan(at(9 * 60) * 1.5);
  });

  it("asigna jugadores existentes y el precio de la cancha", () => {
    const bookings = generateSeedBookings(input());

    expect(bookings.every((b) => [100, 200, 300].includes(b.bookerId))).toBe(true);
    expect(bookings.every((b) => b.price === 10000 + b.courtId)).toBe(true);
  });

  it("no repite turnos ni pisa los que ya existen en la cancha", () => {
    const existing = [
      { courtId: 1, fromDateTime: new Date(2026, 9, 12, 19, 30), durationMinutes: 90 },
      // Un turno fuera de la grilla que se cruza con los de 18:00 y 19:30.
      { courtId: 2, fromDateTime: new Date(2026, 9, 12, 19, 0), durationMinutes: 60 },
    ];
    const bookings = generateSeedBookings(input({ existing }));
    const keys = bookings.map((b) => `${b.courtId}-${b.fromDateTime.getTime()}`);

    expect(new Set(keys).size).toBe(keys.length);
    const overlaps = (b: (typeof bookings)[number], e: (typeof existing)[number]) =>
      b.courtId === e.courtId &&
      b.fromDateTime.getTime() < e.fromDateTime.getTime() + e.durationMinutes * 60_000 &&
      e.fromDateTime.getTime() < b.fromDateTime.getTime() + b.durationMinutes * 60_000;
    expect(bookings.some((b) => existing.some((e) => overlaps(b, e)))).toBe(false);
  });

  it("no agrega turnos en un día que ya tiene turnos cargados", () => {
    const existing = [{ courtId: 1, fromDateTime: new Date(2026, 9, 12, 9, 0), durationMinutes: 90 }];
    const bookings = generateSeedBookings(input({ existing }));

    const sameDay = (b: (typeof bookings)[number]) => b.fromDateTime.toDateString() === new Date(2026, 9, 12).toDateString();
    expect(bookings.some(sameDay)).toBe(false);
    expect(bookings.some((b) => b.fromDateTime.toDateString() === new Date(2026, 9, 13).toDateString())).toBe(true);
  });

  it("correrlo de nuevo sobre lo ya generado no agrega turnos", () => {
    const existing = generateSeedBookings(input()).filter((b) => b.bookingState !== BookingState.CANCELLED);

    expect(generateSeedBookings(input({ existing }))).toEqual([]);
  });

  it("es determinístico: con los mismos datos genera los mismos turnos", () => {
    expect(generateSeedBookings(input())).toEqual(generateSeedBookings(input()));
  });

  it("sin jugadores no genera turnos", () => {
    expect(generateSeedBookings(input({ playerIds: [] }))).toEqual([]);
  });
});
