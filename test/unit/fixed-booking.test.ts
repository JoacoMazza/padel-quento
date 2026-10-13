import { describe, expect, it } from "vitest";
import { DayOfWeek, FixedBookingFrequency } from "@/src/domain/enums";
import {
  addDaysISO,
  dayOfWeekOfISO,
  occurrenceDates,
  occurrenceStart,
} from "@/src/domain/fixed-booking";

describe("occurrenceDates", () => {
  // El lunes 5 de octubre de 2026 es el primer turno de la serie.
  const weekly = { startDate: "2026-10-05", frequency: FixedBookingFrequency.WEEKLY, endDate: null };

  it("genera una fecha por semana dentro del rango pedido", () => {
    expect(occurrenceDates(weekly, "2026-10-05", "2026-10-26")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
  });

  it("arranca en la primera fecha de la serie que cae dentro del rango, sin desfasarse", () => {
    expect(occurrenceDates(weekly, "2026-10-14", "2026-10-27")).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("no genera fechas anteriores al inicio de la serie", () => {
    expect(occurrenceDates(weekly, "2026-09-01", "2026-10-12")).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("en una serie quincenal genera una fecha cada dos semanas a partir del inicio", () => {
    const biweekly = { ...weekly, frequency: FixedBookingFrequency.BIWEEKLY };

    expect(occurrenceDates(biweekly, "2026-10-06", "2026-11-30")).toEqual([
      "2026-10-19",
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
    ]);
  });

  it("no genera fechas posteriores a la fecha de fin", () => {
    const withEnd = { ...weekly, endDate: "2026-10-15" };

    expect(occurrenceDates(withEnd, "2026-10-01", "2026-12-31")).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("devuelve una lista vacía si el rango termina antes de que empiece la serie", () => {
    expect(occurrenceDates(weekly, "2026-09-01", "2026-10-04")).toEqual([]);
  });
});

describe("occurrenceStart", () => {
  it("combina la fecha con la hora del turno fijo en hora local del club", () => {
    expect(occurrenceStart("2026-10-05", "18:30")).toEqual(new Date(2026, 9, 5, 18, 30));
  });
});

describe("addDaysISO", () => {
  it("suma días a una fecha, cruzando de mes", () => {
    expect(addDaysISO("2026-10-30", 3)).toBe("2026-11-02");
  });
});

describe("dayOfWeekOfISO", () => {
  it("devuelve el día de la semana de la fecha", () => {
    expect(dayOfWeekOfISO("2026-10-05")).toBe(DayOfWeek.MONDAY);
    expect(dayOfWeekOfISO("2026-10-11")).toBe(DayOfWeek.SUNDAY);
  });
});
