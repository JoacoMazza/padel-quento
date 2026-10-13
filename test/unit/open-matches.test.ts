import { describe, expect, it } from "vitest";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import type { Booking } from "@/src/entities/Booking";
import {
  anonymizeOpenMatch,
  anonymizeOpenMatchItem,
  listOpenMatches,
  matchesOpenMatchFilter,
  toOpenMatchDetail,
} from "@/app/open-matches/open-matches";

const NOW = new Date(2026, 9, 12, 10, 0);

type MatchPlayerSeed = { id: number; names: string; lastnames: string; playersCount?: number; category?: PlayerCategory };

function booking(
  overrides: {
    id?: number;
    fromDateTime?: Date;
    bookingState?: BookingState;
    needPlayers?: boolean;
    players?: MatchPlayerSeed[];
    withoutMatch?: boolean;
    chatId?: number;
  } = {},
): Booking {
  const players = overrides.players ?? [{ id: 1, names: "Martín", lastnames: "Prado", playersCount: 2 }];
  return {
    id: overrides.id ?? 10,
    fromDateTime: overrides.fromDateTime ?? new Date(2026, 9, 12, 19, 30),
    durationMinutes: 90,
    bookingState: overrides.bookingState ?? BookingState.RESERVED,
    price: 18000,
    attended: true,
    pointsAwarded: false,
    booker: { id: 1, names: "Martín", lastnames: "Prado", phoneNumber: "2215550101", bookings: [] },
    court: { id: 3, number: 2 },
    match: overrides.withoutMatch
      ? undefined
      : {
          id: 5,
          needPlayers: overrides.needPlayers ?? true,
          chat: overrides.chatId ? { id: overrides.chatId } : undefined,
          matchPlayers: players.map((p, index) => ({
            id: 100 + index,
            playerId: p.id,
            playersCount: p.playersCount ?? 1,
            attended: true,
            player: { id: p.id, names: p.names, lastnames: p.lastnames, category: p.category ?? PlayerCategory.FIFTH },
          })),
        },
  } as unknown as Booking;
}

describe("listOpenMatches", () => {
  it("lista los partidos que buscan jugadores con sus cupos, cancha, precio y organizador", () => {
    const [item] = listOpenMatches([booking()], null, NOW);

    expect(item).toEqual({
      bookingId: 10,
      start: new Date(2026, 9, 12, 19, 30),
      end: new Date(2026, 9, 12, 21, 0),
      courtNumber: 2,
      price: 18000,
      confirmedPlayers: 2,
      remainingSpots: 2,
      organizerName: "Martín Prado",
      alreadyJoined: false,
    });
  });

  it("excluye turnos sin partido, partidos completos, cancelados y los que ya empezaron", () => {
    const result = listOpenMatches(
      [
        booking({ id: 1, withoutMatch: true }),
        booking({ id: 2, needPlayers: false }),
        booking({ id: 3, bookingState: BookingState.CANCELLED }),
        booking({ id: 4, fromDateTime: new Date(2026, 9, 12, 9, 0) }),
        booking({ id: 5 }),
      ],
      null,
      NOW,
    );

    expect(result.map((m) => m.bookingId)).toEqual([5]);
  });

  it("indica si el jugador logueado ya está anotado", () => {
    const [item] = listOpenMatches([booking()], 1, NOW);
    expect(item.alreadyJoined).toBe(true);
  });

  it("ordena los partidos del más próximo al más lejano", () => {
    const result = listOpenMatches(
      [
        booking({ id: 1, fromDateTime: new Date(2026, 9, 14, 18, 0) }),
        booking({ id: 2, fromDateTime: new Date(2026, 9, 12, 21, 0) }),
      ],
      null,
      NOW,
    );

    expect(result.map((m) => m.bookingId)).toEqual([2, 1]);
  });
});

describe("matchesOpenMatchFilter", () => {
  it("filtra por hoy y por los próximos 7 días", () => {
    const today = new Date(2026, 9, 12, 21, 0);
    const inFiveDays = new Date(2026, 9, 17, 18, 0);
    const inTenDays = new Date(2026, 9, 22, 18, 0);

    expect(matchesOpenMatchFilter(today, NOW, "today")).toBe(true);
    expect(matchesOpenMatchFilter(inFiveDays, NOW, "today")).toBe(false);
    expect(matchesOpenMatchFilter(inFiveDays, NOW, "week")).toBe(true);
    expect(matchesOpenMatchFilter(inTenDays, NOW, "week")).toBe(false);
    expect(matchesOpenMatchFilter(inTenDays, NOW, "all")).toBe(true);
  });
});

describe("toOpenMatchDetail", () => {
  it("devuelve los participantes marcando al organizador y sus acompañantes", () => {
    const detail = toOpenMatchDetail(
      booking({
        players: [
          { id: 1, names: "Martín", lastnames: "Prado", playersCount: 2 },
          { id: 2, names: "Lucas", lastnames: "Valenzuela", category: PlayerCategory.SIXTH },
        ],
        chatId: 9,
      }),
      2,
      NOW,
    );

    expect(detail).toMatchObject({
      bookingId: 10,
      confirmedPlayers: 3,
      remainingSpots: 1,
      alreadyJoined: true,
      chatId: 9,
      status: "open",
    });
    expect(detail!.participants).toEqual([
      {
        playerId: 1,
        name: "Martín Prado",
        initials: "MP",
        category: PlayerCategory.FIFTH,
        playersCount: 2,
        isOrganizer: true,
      },
      {
        playerId: 2,
        name: "Lucas Valenzuela",
        initials: "LV",
        category: PlayerCategory.SIXTH,
        playersCount: 1,
        isOrganizer: false,
      },
    ]);
  });

  it("informa si el partido está completo, cancelado o ya empezó", () => {
    expect(toOpenMatchDetail(booking({ needPlayers: false }), null, NOW)!.status).toBe("full");
    expect(toOpenMatchDetail(booking({ bookingState: BookingState.CANCELLED }), null, NOW)!.status).toBe("cancelled");
    expect(toOpenMatchDetail(booking({ fromDateTime: new Date(2026, 9, 12, 9, 0) }), null, NOW)!.status).toBe("past");
  });

  it("devuelve null si el turno no tiene partido asociado", () => {
    expect(toOpenMatchDetail(booking({ withoutMatch: true }), null, NOW)).toBeNull();
  });
});

describe("vista de partidos abiertos para visitantes sin sesión", () => {
  it("oculta el nombre del organizador en el listado", () => {
    const [item] = listOpenMatches([booking()], null, NOW);

    expect(anonymizeOpenMatchItem(item)).toEqual({ ...item, organizerName: "Jugador del club" });
  });

  it("en el detalle oculta los nombres de los jugadores y el chat, pero deja la categoría y los cupos", () => {
    const detail = toOpenMatchDetail(
      booking({
        chatId: 9,
        players: [
          { id: 1, names: "Martín", lastnames: "Prado", playersCount: 2, category: PlayerCategory.THIRD },
          { id: 2, names: "Lucía", lastnames: "Gómez" },
        ],
      }),
      null,
      NOW,
    )!;

    const anonymous = anonymizeOpenMatch(detail);

    expect(anonymous.organizerName).toBe("Jugador del club");
    expect(anonymous.chatId).toBeNull();
    expect(anonymous.participants.map((p) => [p.name, p.initials, p.category, p.playersCount, p.isOrganizer])).toEqual([
      ["Jugador del club", "", PlayerCategory.THIRD, 2, true],
      ["Jugador del club", "", PlayerCategory.FIFTH, 1, false],
    ]);
    expect(JSON.stringify(anonymous)).not.toMatch(/Martín|Prado|Lucía|Gómez/);
    expect(anonymous.remainingSpots).toBe(detail.remainingSpots);
  });
});
