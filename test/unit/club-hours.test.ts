import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import { summarizeClubHours } from "@/app/landing/club-hours";

const ALL_DAYS = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

function schedule(dayOfWeek: DayOfWeek, openingTime: string, closingTime: string, courtId = 1) {
  return { dayOfWeek, openingTime, closingTime, courtId };
}

describe("summarizeClubHours", () => {
  it("junta en un solo rango los días que abren y cierran a la misma hora", () => {
    const schedules = ALL_DAYS.map((day) => schedule(day, "09:00:00", "23:00:00"));

    expect(summarizeClubHours(schedules)).toEqual([{ days: "Lunes a domingo", hours: "09:00 – 23:00" }]);
  });

  it("separa los días con horarios distintos, en orden de lunes a domingo", () => {
    const schedules = [
      ...ALL_DAYS.slice(0, 5).map((day) => schedule(day, "08:00:00", "23:00:00")),
      schedule(DayOfWeek.SATURDAY, "09:00:00", "20:00:00"),
      schedule(DayOfWeek.SUNDAY, "09:00:00", "20:00:00"),
    ].reverse();

    expect(summarizeClubHours(schedules)).toEqual([
      { days: "Lunes a viernes", hours: "08:00 – 23:00" },
      { days: "Sábado y domingo", hours: "09:00 – 20:00" },
    ]);
  });

  it("toma de cada día el horario más amplio entre todas las canchas", () => {
    const schedules = [
      schedule(DayOfWeek.MONDAY, "09:00:00", "22:00:00", 1),
      schedule(DayOfWeek.MONDAY, "08:00:00", "21:00:00", 2),
    ];

    expect(summarizeClubHours(schedules)).toEqual([{ days: "Lunes", hours: "08:00 – 22:00" }]);
  });

  it("no junta días que no son consecutivos y omite los que no abren", () => {
    const schedules = [
      schedule(DayOfWeek.MONDAY, "09:00:00", "23:00:00"),
      schedule(DayOfWeek.WEDNESDAY, "09:00:00", "23:00:00"),
    ];

    expect(summarizeClubHours(schedules)).toEqual([
      { days: "Lunes", hours: "09:00 – 23:00" },
      { days: "Miércoles", hours: "09:00 – 23:00" },
    ]);
  });

  it("devuelve una lista vacía si no hay horarios cargados", () => {
    expect(summarizeClubHours([])).toEqual([]);
  });
});
