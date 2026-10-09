import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import { computeOccupancyMetrics, type OccupancyInput } from "@/src/domain/occupancy";

// 2026-10-12 es lunes.
const monday = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

function baseInput(overrides: Partial<OccupancyInput> = {}): OccupancyInput {
  return {
    from: new Date(2026, 9, 12),
    to: new Date(2026, 9, 12),
    courts: [
      { id: 10, number: 1 },
      { id: 20, number: 2 },
    ],
    schedules: [
      { courtId: 10, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "12:00:00" },
      { courtId: 20, dayOfWeek: DayOfWeek.MONDAY, openingTime: "10:00:00", closingTime: "12:00:00" },
    ],
    bookings: [
      { courtId: 10, fromDateTime: monday(8, 0), durationMinutes: 90 },
      { courtId: 10, fromDateTime: monday(10, 30), durationMinutes: 90 },
      { courtId: 20, fromDateTime: monday(10, 0), durationMinutes: 60 },
    ],
    // La cancha 2 está bloqueada de 11 a 12: esa hora no cuenta como disponible.
    outOfServices: [{ courtId: 20, fromDateTime: monday(11, 0), toDateTime: monday(12, 0) }],
    ...overrides,
  };
}

describe("computeOccupancyMetrics", () => {
  it("calcula la ocupación total como minutos reservados sobre minutos disponibles", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.total).toEqual({ bookedMinutes: 240, availableMinutes: 300, occupancy: 0.8, bookingsCount: 3 });
  });

  it("discrimina la ocupación por cancha, descontando los bloqueos de lo disponible", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byCourt).toEqual([
      { courtId: 10, courtNumber: 1, bookedMinutes: 180, availableMinutes: 240, occupancy: 0.75 },
      { courtId: 20, courtNumber: 2, bookedMinutes: 60, availableMinutes: 60, occupancy: 1 },
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
      bookedMinutes: 240,
      availableMinutes: 300,
      occupancy: 0.8,
    });
    expect(metrics.byDayOfWeek[1]).toEqual({
      dayOfWeek: DayOfWeek.TUESDAY,
      bookedMinutes: 0,
      availableMinutes: 0,
      occupancy: 0,
    });
  });

  it("discrimina la ocupación por franja horaria de una hora, solo en las franjas con horario", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byHour).toEqual([
      { hour: 8, bookedMinutes: 60, availableMinutes: 60, occupancy: 1 },
      { hour: 9, bookedMinutes: 30, availableMinutes: 60, occupancy: 0.5 },
      { hour: 10, bookedMinutes: 90, availableMinutes: 120, occupancy: 0.75 },
      { hour: 11, bookedMinutes: 60, availableMinutes: 60, occupancy: 1 },
    ]);
  });

  it("cruza día de la semana y franja horaria para detectar los horarios pico", () => {
    const metrics = computeOccupancyMetrics(baseInput());

    expect(metrics.byDayAndHour).toEqual([
      { dayOfWeek: DayOfWeek.MONDAY, hour: 8, bookedMinutes: 60, availableMinutes: 60, occupancy: 1 },
      { dayOfWeek: DayOfWeek.MONDAY, hour: 9, bookedMinutes: 30, availableMinutes: 60, occupancy: 0.5 },
      { dayOfWeek: DayOfWeek.MONDAY, hour: 10, bookedMinutes: 90, availableMinutes: 120, occupancy: 0.75 },
      { dayOfWeek: DayOfWeek.MONDAY, hour: 11, bookedMinutes: 60, availableMinutes: 60, occupancy: 1 },
    ]);
  });

  it("suma la disponibilidad de cada día del rango", () => {
    const metrics = computeOccupancyMetrics(baseInput({ to: new Date(2026, 9, 19), outOfServices: [] }));

    // Dos lunes en el rango: el doble de minutos disponibles, mismas reservas.
    expect(metrics.byCourt[0]).toMatchObject({ bookedMinutes: 180, availableMinutes: 480, occupancy: 0.375 });
  });

  it("solo cuenta la parte de la reserva que cae dentro del horario de la cancha", () => {
    const metrics = computeOccupancyMetrics(
      baseInput({ bookings: [{ courtId: 10, fromDateTime: monday(11, 30), durationMinutes: 90 }], outOfServices: [] }),
    );

    expect(metrics.byCourt[0]).toMatchObject({ bookedMinutes: 30, availableMinutes: 240 });
  });

  it("ignora las reservas fuera del rango de fechas", () => {
    const metrics = computeOccupancyMetrics(
      baseInput({ bookings: [{ courtId: 10, fromDateTime: new Date(2026, 9, 13, 8, 0), durationMinutes: 90 }] }),
    );

    expect(metrics.total).toMatchObject({ bookedMinutes: 0, bookingsCount: 0 });
  });

  it("sin horarios configurados la ocupación es 0 y no hay franjas", () => {
    const metrics = computeOccupancyMetrics(baseInput({ schedules: [] }));

    expect(metrics.total).toMatchObject({ availableMinutes: 0, occupancy: 0 });
    expect(metrics.byHour).toEqual([]);
    expect(metrics.byDayAndHour).toEqual([]);
  });
});
