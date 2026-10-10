import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import { computeOccupancyMetrics, type OccupancyInput } from "@/src/domain/occupancy";

// 2026-10-12 es lunes.
const monday = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

// Turnos de 90 minutos desde la apertura más temprana del día (8:00): 8:00, 9:30 y 11:00.
function baseInput(overrides: Partial<OccupancyInput> = {}): OccupancyInput {
  return {
    from: new Date(2026, 9, 12),
    to: new Date(2026, 9, 12),
    courts: [
      { id: 10, number: 1 },
      { id: 20, number: 2 },
    ],
    schedules: [
      { courtId: 10, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "12:30:00" },
      { courtId: 20, dayOfWeek: DayOfWeek.MONDAY, openingTime: "09:30:00", closingTime: "12:30:00" },
    ],
    bookings: [
      { courtId: 10, fromDateTime: monday(8, 0), durationMinutes: 90 },
      { courtId: 10, fromDateTime: monday(11, 0), durationMinutes: 45 },
      { courtId: 20, fromDateTime: monday(9, 30), durationMinutes: 90 },
    ],
    // La cancha 2 está bloqueada en el turno de las 11:00: no cuenta como disponible.
    outOfServices: [{ courtId: 20, fromDateTime: monday(11, 0), toDateTime: monday(12, 30) }],
    ...overrides,
  };
}

describe("computeOccupancyMetrics", () => {
  it("calcula la ocupación total como minutos reservados sobre minutos disponibles", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.total).toEqual({ bookedMinutes: 225, availableMinutes: 360, occupancy: 0.625, bookingsCount: 3 });
  });

  it("discrimina la ocupación por cancha, descontando los bloqueos de lo disponible", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byCourt).toEqual([
      { courtId: 10, courtNumber: 1, bookedMinutes: 135, availableMinutes: 270, occupancy: 0.5 },
      { courtId: 20, courtNumber: 2, bookedMinutes: 90, availableMinutes: 90, occupancy: 1 },
    ]);
  });

  it("discrimina la ocupación por día de la semana, de lunes a domingo", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byDayOfWeek.map((d) => d.dayOfWeek)).toEqual([
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
      DayOfWeek.SUNDAY,
    ]);
    expect(metrics.byDayOfWeek[0]).toEqual({
      dayOfWeek: DayOfWeek.MONDAY,
      bookedMinutes: 225,
      availableMinutes: 360,
      occupancy: 0.625,
    });
    expect(metrics.byDayOfWeek[1]).toEqual({
      dayOfWeek: DayOfWeek.TUESDAY,
      bookedMinutes: 0,
      availableMinutes: 0,
      occupancy: 0,
    });
  });

  it("discrimina la ocupación por turno de 90 minutos, desde la apertura más temprana del día", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.bySlot).toEqual([
      { startMinutes: 8 * 60, bookedMinutes: 90, availableMinutes: 90, occupancy: 1 },
      { startMinutes: 9 * 60 + 30, bookedMinutes: 90, availableMinutes: 180, occupancy: 0.5 },
      { startMinutes: 11 * 60, bookedMinutes: 45, availableMinutes: 90, occupancy: 0.5 },
    ]);
  });

  it("cruza día de la semana y turno para detectar los horarios pico", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byDayAndSlot).toEqual([
      { dayOfWeek: DayOfWeek.MONDAY, startMinutes: 8 * 60, bookedMinutes: 90, availableMinutes: 90, occupancy: 1 },
      {
        dayOfWeek: DayOfWeek.MONDAY,
        startMinutes: 9 * 60 + 30,
        bookedMinutes: 90,
        availableMinutes: 180,
        occupancy: 0.5,
      },
      { dayOfWeek: DayOfWeek.MONDAY, startMinutes: 11 * 60, bookedMinutes: 45, availableMinutes: 90, occupancy: 0.5 },
    ]);
  });

  it("no cuenta como disponible el tiempo al final del día que no completa un turno", () => {
    const metrics = computeOccupancyMetrics(
      baseInput({
        schedules: [{ courtId: 10, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "10:00:00" }],
      }),
    );

    // Solo entra el turno de 8:00 a 9:30; de 9:30 a 10:00 no hay turno posible.
    expect(metrics.byCourt[0]).toMatchObject({ availableMinutes: 90 });
    expect(metrics.bySlot.map((s) => s.startMinutes)).toEqual([8 * 60]);
  });

  it("suma la disponibilidad de cada día del rango", () => {
    const metrics = computeOccupancyMetrics(baseInput({ to: new Date(2026, 9, 19), outOfServices: [] }));

    // Dos lunes en el rango: el doble de minutos disponibles, mismas reservas.
    expect(metrics.byCourt[0]).toMatchObject({ bookedMinutes: 135, availableMinutes: 540, occupancy: 0.25 });
  });

  it("solo cuenta la parte de la reserva que cae dentro del horario de la cancha", () => {
    const metrics = computeOccupancyMetrics(
      baseInput({ bookings: [{ courtId: 10, fromDateTime: monday(12, 0), durationMinutes: 90 }], outOfServices: [] }),
    );

    expect(metrics.byCourt[0]).toMatchObject({ bookedMinutes: 30, availableMinutes: 270 });
  });

  it("ignora las reservas fuera del rango de fechas", () => {
    const metrics = computeOccupancyMetrics(
      baseInput({ bookings: [{ courtId: 10, fromDateTime: new Date(2026, 9, 13, 8, 0), durationMinutes: 90 }] }),
    );

    expect(metrics.total).toMatchObject({ bookedMinutes: 0, bookingsCount: 0 });
  });

  it("sin horarios configurados la ocupación es 0 y no hay turnos", () => {
    const metrics = computeOccupancyMetrics(baseInput({ schedules: [] }));

    expect(metrics.total).toMatchObject({ availableMinutes: 0, occupancy: 0 });
    expect(metrics.bySlot).toEqual([]);
    expect(metrics.byDayAndSlot).toEqual([]);
  });
});
