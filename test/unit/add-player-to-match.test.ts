import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

const { bookings, players, matches, matchPlayers, chats, getDataSource } = vi.hoisted(() => {
  const bookings = { findOne: vi.fn() };
  const players = { findOne: vi.fn() };
  const matches = { findOne: vi.fn(), update: vi.fn() };
  const matchPlayers = {
    create: vi.fn((entity: unknown) => entity),
    save: vi.fn(),
    update: vi.fn(),
  };
  const chats = { create: vi.fn((entity: unknown) => entity), save: vi.fn() };
  const repositories: Record<string, unknown> = {
    Chat: chats,
    Booking: bookings,
    Player: players,
    Match: matches,
    MatchPlayer: matchPlayers,
  };
  const getRepository = vi.fn((name: string) => repositories[name]);
  const query = vi.fn();
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb({ getRepository, query }));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));
  return { bookings, players, matches, matchPlayers, chats, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

const { notifyPlayerJoined } = vi.hoisted(() => ({ notifyPlayerJoined: vi.fn(async () => {}) }));

vi.mock("@/src/lib/match-notifications", () => ({
  notifyPlayerJoined,
  notifyMatchClosed: vi.fn(),
  notifyMatchesExpired: vi.fn(),
  notifyPlayerLeft: vi.fn(),
}));
vi.mock("@/src/actions/profile", () => ({ recordPointsMovement: vi.fn() }));

import { getServerSession } from "next-auth/next";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { addPlayerToMatch } from "@/src/actions/match";

const NOW = new Date("2026-10-01T10:00:00");
const BOOKING_START = new Date("2026-10-05T18:00:00");

function player(overrides: { id?: number; names?: string; isBlocked?: boolean } = {}) {
  return {
    id: overrides.id ?? 7,
    names: overrides.names ?? "Ana",
    lastnames: "Gómez",
    phoneNumber: "2215550101",
    category: PlayerCategory.FOURTH,
    account: { id: 70, email: "ana@test.com", passwordHash: "$2b$10$hash", isBlocked: overrides.isBlocked ?? false },
  };
}

const CARO = { id: 9, names: "Caro" };

/** Booking 3 with its open match 2, where the inviter Ana (player 7) is a member. */
function openMatchBooking(overrides: { bookingState?: BookingState; fromDateTime?: Date; memberIds?: number[] } = {}) {
  return {
    id: 3,
    fromDateTime: overrides.fromDateTime ?? BOOKING_START,
    durationMinutes: 90,
    bookingState: overrides.bookingState ?? BookingState.RESERVED,
    match: { id: 2, matchPlayers: (overrides.memberIds ?? [7]).map((playerId) => ({ playerId })) },
  };
}

function mockSession(email: string | null) {
  vi.mocked(getServerSession).mockResolvedValue((email ? { user: { email } } : null) as never);
}

/** Valid request up to the transaction, where the match has the given confirmed players. */
function arrange(
  options: { inviterPlayersCount?: number; otherPlayersCount?: number; needPlayers?: boolean; chatId?: number } = {},
) {
  mockSession("ana@test.com");
  players.findOne.mockResolvedValueOnce(player()).mockResolvedValueOnce(player(CARO));
  bookings.findOne.mockResolvedValueOnce(openMatchBooking());
  matches.findOne.mockResolvedValueOnce({
    id: 2,
    needPlayers: options.needPlayers ?? true,
    chat: options.chatId ? { id: options.chatId } : null,
    matchPlayers: [
      { id: 30, playerId: 7, playersCount: options.inviterPlayersCount ?? 1 },
      ...(options.otherPlayersCount ? [{ id: 31, playerId: 8, playersCount: options.otherPlayersCount }] : []),
    ],
  });
}

describe("addPlayerToMatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    matchPlayers.create.mockImplementation((entity: unknown) => entity);
    chats.create.mockImplementation((entity: unknown) => entity);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a registered player found by email, taking a free spot, and notifies the other players", async () => {
    arrange({ otherPlayersCount: 1 });

    const result = await addPlayerToMatch(3, "  Caro@Test.com ");

    expect(players.findOne).toHaveBeenLastCalledWith({
      where: { account: { email: "caro@test.com" } },
      relations: { account: true },
    });
    expect(matchPlayers.create).toHaveBeenCalledWith({ match: { id: 2 }, player: { id: 9 }, playersCount: 1 });
    expect(matchPlayers.save).toHaveBeenCalledTimes(1);
    expect(matches.update).not.toHaveBeenCalled();
    expect(notifyPlayerJoined).toHaveBeenCalledWith(3, 9);
    // Only name and category of the added player: never their email or phone.
    expect(result).toEqual({
      success: true,
      data: { id: 9, names: "Caro", lastnames: "Gómez", category: PlayerCategory.FOURTH },
    });
  });

  it("works before the chat room exists: it only needs the open match", async () => {
    arrange();

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(bookings.findOne).toHaveBeenCalledWith({ where: { id: 3 }, relations: { match: { matchPlayers: true } } });
    expect(result.success).toBe(true);
  });

  it("finds the player by phone number, ignoring spaces, dashes and parentheses", async () => {
    arrange();

    const result = await addPlayerToMatch(3, "(221) 555-0101");

    expect(players.findOne).toHaveBeenLastCalledWith({
      where: { phoneNumber: "2215550101" },
      relations: { account: true },
    });
    expect(result.success).toBe(true);
  });

  it("stops looking for players when the added player completes the match", async () => {
    arrange({ otherPlayersCount: 2 });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result.success).toBe(true);
    expect(matches.update).toHaveBeenCalledWith(2, { needPlayers: false });
  });

  it("replaces one of the inviter's companions instead of taking a free spot", async () => {
    arrange({ inviterPlayersCount: 2 });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result.success).toBe(true);
    expect(matchPlayers.update).toHaveBeenCalledWith(30, { playersCount: 1 });
    expect(matchPlayers.create).toHaveBeenCalledWith({ match: { id: 2 }, player: { id: 9 }, playersCount: 1 });
    expect(matches.update).not.toHaveBeenCalled();
  });

  it("can replace a companion even if the match is no longer looking for players", async () => {
    arrange({ inviterPlayersCount: 2, otherPlayersCount: 2, needPlayers: false });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result.success).toBe(true);
    expect(matchPlayers.update).toHaveBeenCalledWith(30, { playersCount: 1 });
  });

  it("rejects adding when there are neither free spots nor companions to replace", async () => {
    arrange({ otherPlayersCount: 3, needPlayers: false });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "No quedan lugares libres en el partido." });
    expect(matchPlayers.save).not.toHaveBeenCalled();
    expect(notifyPlayerJoined).not.toHaveBeenCalled();
  });

  it("rejects a player who is already in the match", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player()).mockResolvedValueOnce(player(CARO));
    bookings.findOne.mockResolvedValueOnce(openMatchBooking({ memberIds: [7, 9] }));
    matches.findOne.mockResolvedValueOnce({
      id: 2,
      needPlayers: true,
      matchPlayers: [
        { id: 30, playerId: 7, playersCount: 1 },
        { id: 31, playerId: 9, playersCount: 1 },
      ],
    });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "Ese jugador ya forma parte del partido." });
    expect(matchPlayers.save).not.toHaveBeenCalled();
  });

  it("rejects an empty identifier", async () => {
    const result = await addPlayerToMatch(3, "   ");

    expect(result).toEqual({ success: false, error: "Ingresá el email o el teléfono del jugador." });
  });

  it("rejects unauthenticated users", async () => {
    mockSession(null);

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "No estás autenticado." });
    expect(bookings.findOne).not.toHaveBeenCalled();
  });

  it("rejects players who are not members of the match, before looking up the identifier", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player());
    bookings.findOne.mockResolvedValueOnce(openMatchBooking({ memberIds: [8] }));

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "No formás parte de este partido." });
    // Non-members cannot use it to find out whether an email or phone is registered.
    expect(players.findOne).toHaveBeenCalledTimes(1);
  });

  it("rejects accounts without a player profile", async () => {
    mockSession("admin@test.com");
    players.findOne.mockResolvedValueOnce(null);

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "No formás parte de este partido." });
  });

  it("rejects blocked inviters", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player({ isBlocked: true }));

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({
      success: false,
      error: "El usuario se encuentra bloqueado y no puede sumar jugadores.",
    });
  });

  it("rejects a booking without an open match", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player());
    bookings.findOne.mockResolvedValueOnce({ ...openMatchBooking(), match: null });

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({ success: false, error: "Este turno no es un partido abierto." });
  });

  it("rejects adding players to a cancelled match", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player());
    bookings.findOne.mockResolvedValueOnce(openMatchBooking({ bookingState: BookingState.CANCELLED }));

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({
      success: false,
      error: "El partido ya no admite jugadores: el turno fue cancelado o ya empezó.",
    });
  });

  it("rejects adding players once the match has started", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player());
    bookings.findOne.mockResolvedValueOnce(openMatchBooking({ fromDateTime: new Date("2026-10-01T09:30:00") }));

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({
      success: false,
      error: "El partido ya no admite jugadores: el turno fue cancelado o ya empezó.",
    });
  });

  it("rejects an identifier that does not belong to a registered player", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player()).mockResolvedValueOnce(null);
    bookings.findOne.mockResolvedValueOnce(openMatchBooking());

    const result = await addPlayerToMatch(3, "nadie@test.com");

    expect(result).toEqual({
      success: false,
      error: "No encontramos un jugador registrado con ese email o teléfono.",
    });
  });

  it("rejects adding a blocked player", async () => {
    mockSession("ana@test.com");
    players.findOne.mockResolvedValueOnce(player()).mockResolvedValueOnce(player({ ...CARO, isBlocked: true }));
    bookings.findOne.mockResolvedValueOnce(openMatchBooking());

    const result = await addPlayerToMatch(3, "caro@test.com");

    expect(result).toEqual({
      success: false,
      error: "Ese jugador se encuentra bloqueado y no puede sumarse a partidos.",
    });
  });

  describe("chat room", () => {
    it("creates the match chat room when the added player is the second member with an account", async () => {
      arrange({ inviterPlayersCount: 2 });

      await addPlayerToMatch(3, "caro@test.com");

      expect(matches.findOne).toHaveBeenCalledWith({ where: { id: 2 }, relations: { matchPlayers: true, chat: true } });
      expect(chats.create).toHaveBeenCalledWith({ match: { id: 2 } });
      expect(chats.save).toHaveBeenCalledTimes(1);
    });

    it("does not create another room when the match already has one", async () => {
      arrange({ otherPlayersCount: 1, chatId: 5 });

      await addPlayerToMatch(3, "caro@test.com");

      expect(chats.save).not.toHaveBeenCalled();
    });

    it("does not create a room if a member left and only one account remains but the room already exists", async () => {
      arrange({ chatId: 5 });

      await addPlayerToMatch(3, "caro@test.com");

      expect(chats.save).not.toHaveBeenCalled();
    });
  });
});
