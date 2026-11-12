import { describe, expect, it } from "vitest";
import { DayOfWeek, FixedBookingFrequency } from "@/src/domain/enums";
import { dayOfWeekOfISO, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import { demoSlots, planDemoSeed } from "@/scripts/demo-seed";

const now = new Date(2026, 10, 12, 15, 0);
const courts = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id }));
const DAY_MS = 24 * 60 * 60_000;

const plan = () => planDemoSeed({ now, courts });
const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

describe("planDemoSeed", () => {
  it("planifica dos clases, cada una con su profesor, alumnos y horarios semanales", () => {
    const { lessons } = plan();

    expect(lessons).toHaveLength(2);
    expect(lessons.map((l) => l.teacher)).toEqual([0, 1]);
    expect(lessons.every((l) => l.students.length > 0 && l.students.length <= l.classCapacity)).toBe(true);
    expect(lessons.every((l) => l.schedules.length > 0)).toBe(true);
    // Una sin fecha de fin y otra con fecha de fin.
    expect(lessons.some((l) => l.toDate === null)).toBe(true);
    expect(lessons.some((l) => l.toDate !== null)).toBe(true);
  });

  it("los turnos de cada clase caen en sus horarios, desde su inicio, con algunos ya dados y otros por venir", () => {
    for (const lesson of plan().lessons) {
      expect(lesson.fromDate < todayISO(now)).toBe(true);
      for (const session of lesson.sessions) {
        const date = todayISO(session.start);
        const schedule = lesson.schedules.find(
          (s) => s.courtId === session.courtId && s.dayOfWeek === dayOfWeekOfISO(date),
        );
        expect(schedule).toBeDefined();
        expect(session.start).toEqual(occurrenceStart(date, schedule!.startTime));
        expect(date >= lesson.fromDate && (lesson.toDate === null || date <= lesson.toDate)).toBe(true);
      }
      expect(lesson.sessions.some((s) => s.start < now)).toBe(true);
      expect(lesson.sessions.some((s) => s.start > now)).toBe(true);
    }
  });

  it("planifica un turno fijo semanal y otro quincenal, ya tomados desde antes de hoy", () => {
    const { fixedBookings } = plan();

    expect(fixedBookings.map((f) => f.frequency).sort()).toEqual(
      [FixedBookingFrequency.BIWEEKLY, FixedBookingFrequency.WEEKLY].sort(),
    );
    for (const fixed of fixedBookings) {
      const step = fixed.frequency === FixedBookingFrequency.WEEKLY ? 7 : 14;
      expect(fixed.dates[0].date).toBe(fixed.startDate);
      expect(fixed.dates.every((d) => dayOfWeekOfISO(d.date) === dayOfWeekOfISO(fixed.startDate))).toBe(true);
      expect(fixed.dates.every((d) => d.start.getTime() === occurrenceStart(d.date, fixed.startTime).getTime())).toBe(true);
      fixed.dates.slice(1).forEach((d, i) => {
        expect(Math.round((d.start.getTime() - fixed.dates[i].start.getTime()) / DAY_MS)).toBe(step);
      });
      expect(fixed.dates.some((d) => d.start < now)).toBe(true);
      expect(fixed.dates.some((d) => d.start > now)).toBe(true);
    }
  });

  it("planifica partidos abiertos con lugares libres, completos y ya jugados", () => {
    const { matches } = plan();
    const total = (m: (typeof matches)[number]) => m.players.reduce((sum, p) => sum + p.playersCount, 0);
    const future = matches.filter((m) => m.start > now);
    const past = matches.filter((m) => m.start < now);

    expect(future.some((m) => total(m) < 4)).toBe(true);
    expect(future.some((m) => total(m) === 4)).toBe(true);
    expect(past.length).toBeGreaterThan(0);
    // Los ya jugados estaban completos (si no, se habrían cancelado).
    expect(past.every((m) => total(m) === 4)).toBe(true);
    // Uno terminó hace menos de 48 horas, para poder calificar a los compañeros.
    expect(past.some((m) => now.getTime() - m.start.getTime() < 48 * 60 * 60_000 && !m.withReviews)).toBe(true);
    expect(past.some((m) => m.withReviews)).toBe(true);
    expect(matches.every((m) => total(m) <= 4 && new Set(m.players.map((p) => p.player)).size === m.players.length)).toBe(
      true,
    );
  });

  it("solo hay mensajes de chat en los partidos con al menos dos jugadores, y los escriben jugadores del partido", () => {
    const { matches } = plan();

    expect(matches.some((m) => m.messages.length > 0)).toBe(true);
    for (const match of matches) {
      if (match.players.length < 2) expect(match.messages).toEqual([]);
      const playerIds = match.players.map((p) => p.player);
      expect(match.messages.every((msg) => playerIds.includes(msg.player))).toBe(true);
    }
  });

  it("todos los turnos están en la grilla de 90 minutos de 09:00 a 23:00 y no se superponen", () => {
    const slots = demoSlots(plan());
    const grid = [540, 630, 720, 810, 900, 990, 1080, 1170, 1260];

    expect(slots.every((s) => grid.includes(minutesOfDay(s.start)) && s.durationMinutes === 90)).toBe(true);
    const keys = slots.map((s) => `${s.courtId}-${s.start.getTime()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("demoSlots incluye los turnos de clases, turnos fijos y partidos", () => {
    const p = plan();
    const expected =
      p.lessons.reduce((sum, l) => sum + l.sessions.length, 0) +
      p.fixedBookings.reduce((sum, f) => sum + f.dates.length, 0) +
      p.matches.length;

    expect(demoSlots(p)).toHaveLength(expected);
  });

  it("cambia las fechas según el momento en que se ejecuta", () => {
    const later = new Date(2026, 11, 20, 15, 0);
    const slots = demoSlots(planDemoSeed({ now: later, courts }));

    expect(slots.some((s) => s.start > new Date(2027, 0, 1))).toBe(true);
    expect(slots.every((s) => s.start > new Date(2026, 10, 1))).toBe(true);
  });

  it("usa las canchas recibidas", () => {
    const ids = new Set(demoSlots(plan()).map((s) => s.courtId));

    expect([...ids].every((id) => courts.some((c) => c.id === id))).toBe(true);
    expect(plan().lessons.flatMap((l) => l.schedules).every((s) => Object.values(DayOfWeek).includes(s.dayOfWeek))).toBe(
      true,
    );
  });
});
