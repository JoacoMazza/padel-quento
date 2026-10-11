import { describe, expect, it } from "vitest";
import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import { buildCourtSlots, summarizeSlots } from "@/app/bookings/slot-utils";
import type { BookingProp, CourtProp, OutOfServiceProp, ScheduleProp } from "@/app/bookings/types";

// Lunes 12/10/2026.
const DATE = new Date(2026, 9, 12);
const NOW = new Date(2026, 9, 11, 10, 0);

const court: CourtProp = { id: 1, number: 1, state: CourtState.AVAILABLE, price: 18000 };

// 18:00 a 22:30: tres turnos de 90 minutos (18:00, 19:30, 21:00).
const schedules: ScheduleProp[] = [
  { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "18:00:00", closingTime: "22:30:00", courtId: 1 },
];

function booking(overrides: Partial<BookingProp> = {}): BookingProp {
  return {
    id: 50,
    fromDateTime: new Date(2026, 9, 12, 19, 30),
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    price: 18000,
    needPlayers: false,
    courtId: 1,
    confirmedPlayers: 4,
    matchPlayerIds: [],
    ...overrides,
  };
}

function slots(
  params: {
    court?: CourtProp;
    bookings?: BookingProp[];
    outOfServices?: OutOfServiceProp[];
    now?: Date;
    playerId?: number | null;
  } = {},
) {
  return buildCourtSlots({
    court: params.court ?? court,
    schedules,
    bookings: params.bookings ?? [],
    outOfServices: params.outOfServices ?? [],
    date: DATE,
    now: params.now ?? NOW,
    playerId: params.playerId ?? null,
  });
}

describe("buildCourtSlots", () => {
  it("arma un turno de 90 minutos por cada franja del horario de la cancha", () => {
    expect(slots().map((s) => [s.minutesOfDay, s.status])).toEqual([
      [18 * 60, "available"],
      [19 * 60 + 30, "available"],
      [21 * 60, "available"],
    ]);
  });

  it("no arma turnos si la cancha no abre ese día", () => {
    const tuesday = buildCourtSlots({
      court,
      schedules,
      bookings: [],
      outOfServices: [],
      date: new Date(2026, 9, 13),
      now: NOW,
      playerId: null,
    });
    expect(tuesday).toEqual([]);
  });

  it("marca ocupado el turno reservado y deja libre el resto", () => {
    expect(slots({ bookings: [booking()] }).map((s) => s.status)).toEqual(["available", "occupied", "available"]);
  });

  it("ignora los turnos cancelados", () => {
    const result = slots({ bookings: [booking({ bookingState: BookingState.CANCELLED })] });
    expect(result.every((s) => s.status === "available")).toBe(true);
  });

  it("marca como partido abierto el turno que todavía busca jugadores, con sus datos", () => {
    const [, open] = slots({
      bookings: [booking({ needPlayers: true, confirmedPlayers: 2, matchPlayerIds: [7] })],
      playerId: 7,
    });
    expect(open).toMatchObject({ status: "open", bookingId: 50, confirmedPlayers: 2, alreadyJoined: true });
  });

  it("marca ocupados los turnos que ya pasaron", () => {
    const result = slots({ now: new Date(2026, 9, 12, 19, 0) });
    expect(result.map((s) => s.status)).toEqual(["occupied", "available", "available"]);
  });

  it("marca fuera de servicio los turnos que caen dentro de un bloqueo", () => {
    const result = slots({
      outOfServices: [
        { id: 1, fromDateTime: new Date(2026, 9, 12, 20, 0), toDateTime: new Date(2026, 9, 12, 23, 0), courtId: 1 },
      ],
    });
    expect(result.map((s) => s.status)).toEqual(["available", "outOfService", "outOfService"]);
  });

  it("marca fuera de servicio todos los turnos de una cancha fuera de servicio, aunque haya un partido abierto", () => {
    const result = slots({
      court: { ...court, state: CourtState.OUT_OF_SERVICE },
      bookings: [booking({ needPlayers: true, confirmedPlayers: 2 })],
    });
    expect(result.every((s) => s.status === "outOfService")).toBe(true);
  });
});

describe("summarizeSlots", () => {
  it("cuenta los turnos libres y los partidos abiertos", () => {
    const result = slots({ bookings: [booking({ needPlayers: true, confirmedPlayers: 3 })] });
    expect(summarizeSlots([result, result])).toEqual({ free: 4, open: 2 });
  });
});
