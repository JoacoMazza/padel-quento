import { describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import { getNextSlotChange } from "@/app/admin/schedule-refresh";
import type { ScheduleProp } from "@/app/bookings/types";

// 2026-10-12 es lunes.
const monday = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

const schedules: ScheduleProp[] = [
  { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "12:30:00", courtId: 1 },
  // Otra cancha que abre más tarde: la grilla arranca igual en el horario más temprano.
  { id: 2, dayOfWeek: DayOfWeek.MONDAY, openingTime: "09:30:00", closingTime: "11:00:00", courtId: 2 },
  { id: 3, dayOfWeek: DayOfWeek.TUESDAY, openingTime: "10:00:00", closingTime: "13:00:00", courtId: 1 },
];

describe("getNextSlotChange", () => {
  it("devuelve el inicio del próximo turno de la grilla (turnos de 90 minutos)", () => {
    expect(getNextSlotChange(monday(9, 0), schedules)).toEqual(monday(9, 30));
  });

  it("si es justo el inicio de un turno, devuelve el siguiente", () => {
    expect(getNextSlotChange(monday(9, 30), schedules)).toEqual(monday(11, 0));
  });

  it("antes de abrir devuelve la apertura del día", () => {
    expect(getNextSlotChange(monday(6, 0), schedules)).toEqual(monday(8, 0));
  });

  it("cuenta el fin del último turno del día como un cambio", () => {
    expect(getNextSlotChange(monday(11, 15), schedules)).toEqual(monday(12, 30));
  });

  it("después del último turno devuelve la apertura del próximo día con horarios", () => {
    expect(getNextSlotChange(monday(20, 0), schedules)).toEqual(new Date(2026, 9, 13, 10, 0));
  });

  it("devuelve null si no hay horarios configurados", () => {
    expect(getNextSlotChange(monday(9, 0), [])).toBeNull();
  });
});
