import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

const { chats, players, matches, matchPlayers, messages, getDataSource } = vi.hoisted(() => {
  const chats = { findOne: vi.fn() };
  const players = { findOne: vi.fn() };
  const matches = { findOne: vi.fn(), update: vi.fn() };
  const matchPlayers = {
    count: vi.fn(),
    create: vi.fn((entity: unknown) => entity),
    save: vi.fn(),
    update: vi.fn(),
  };
  const messages = {
    find: vi.fn(),
    create: vi.fn((entity: unknown) => entity),
    save: vi.fn(),
  };
  const repositories: Record<string, unknown> = {
    Chat: chats,
    Player: players,
    Match: matches,
    MatchPlayer: matchPlayers,
    Message: messages,
  };
  const getRepository = vi.fn((name: string) => repositories[name]);
  const query = vi.fn();
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb({ getRepository, query }));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));
  return { chats, players, matches, matchPlayers, messages, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

const { notifyPlayerJoined } = vi.hoisted(() => ({ notifyPlayerJoined: vi.fn(async () => {}) }));

vi.mock("@/src/lib/match-notifications", () => ({ notifyPlayerJoined }));

import { getServerSession } from "next-auth/next";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/src/domain/constants";
import { addPlayerToChat, getChatById, getChatMessages, sendMessage } from "@/src/actions/chat";

// Jugador tal como lo devuelve la base: con su teléfono (heredado de Booker) y
// su cuenta, que traen todos sus datos de contacto y privados.
function fullPlayer(overrides: { id?: number; names?: string; isBlocked?: boolean } = {}) {
  return {
    id: overrides.id ?? 7,
    names: overrides.names ?? "Ana",
    lastnames: "Gómez",
    phoneNumber: "+54 221 555-0101",
    category: PlayerCategory.FOURTH,
    account: {
      id: 70,
      email: "ana@test.com",
      passwordHash: "$2b$10$hash",
      isBlocked: overrides.isBlocked ?? false,
    },
  };
}

const PRIVATE_KEYS = ["email", "phoneNumber", "passwordHash", "account"];

function expectNoPrivateData(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const key of PRIVATE_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
  expect(serialized).not.toContain("555-0101");
  expect(serialized).not.toContain("ana@test.com");
}

function mockSession(email: string | null) {
  vi.mocked(getServerSession).mockResolvedValue((email ? { user: { email } } : null) as never);
}

// El turno es el 2026-10-01 de 18:00 a 19:30; "ahora" se fija antes o después según el caso.
const BOOKING_START = new Date("2026-10-01T18:00:00");
const BEFORE_BOOKING_END = new Date("2026-10-01T19:29:59");
const AT_BOOKING_END = new Date("2026-10-01T19:30:00");

function chatWithBooking(bookingState: BookingState = BookingState.RESERVED) {
  return { id: 1, match: { id: 2, booking: { id: 3, fromDateTime: BOOKING_START, durationMinutes: 90, bookingState } } };
}

describe("chat actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    messages.create.mockImplementation((entity: unknown) => entity);
    matchPlayers.create.mockImplementation((entity: unknown) => entity);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(BEFORE_BOOKING_END);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getChatById", () => {
    it("devuelve la sala con el turno y solo nombre y categoría de los jugadores", async () => {
      const fromDateTime = new Date("2026-10-01T18:00:00");
      chats.findOne.mockResolvedValueOnce({
        id: 1,
        match: {
          id: 2,
          booking: { id: 4, fromDateTime, durationMinutes: 90, bookingState: BookingState.RESERVED, court: { number: 3 } },
          matchPlayers: [{ player: fullPlayer() }],
        },
      });

      const result = await getChatById(1);

      expect(chats.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: {
          match: { booking: { court: true }, matchPlayers: { player: true } },
        },
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: 1,
          booking: { id: 4, fromDateTime, courtNumber: 3 },
          participants: [{ id: 7, names: "Ana", lastnames: "Gómez", category: PlayerCategory.FOURTH }],
          isClosed: false,
          closedReason: null,
        },
      });
      expectNoPrivateData(result);
    });

    it("marca la sala como cerrada una vez finalizado el horario del turno", async () => {
      vi.setSystemTime(AT_BOOKING_END);
      chats.findOne.mockResolvedValueOnce({
        ...chatWithBooking(),
        match: { ...chatWithBooking().match, matchPlayers: [{ player: fullPlayer() }] },
      });

      const result = await getChatById(1);

      expect(result).toMatchObject({ success: true, data: { id: 1, isClosed: true, closedReason: "finished" } });
    });

    it("marca la sala como cerrada si el turno fue cancelado, aunque no haya llegado su horario", async () => {
      chats.findOne.mockResolvedValueOnce({
        ...chatWithBooking(BookingState.CANCELLED),
        match: { ...chatWithBooking(BookingState.CANCELLED).match, matchPlayers: [{ player: fullPlayer() }] },
      });

      const result = await getChatById(1);

      expect(result).toMatchObject({ success: true, data: { id: 1, isClosed: true, closedReason: "cancelled" } });
    });

    it("devuelve data null cuando no existe", async () => {
      chats.findOne.mockResolvedValueOnce(null);

      const result = await getChatById(999);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve un error genérico si falla la consulta", async () => {
      chats.findOne.mockRejectedValueOnce(new Error("db down"));

      const result = await getChatById(1);

      expect(result).toEqual({ success: false, error: "No se pudo obtener el chat." });
    });
  });

  describe("getChatMessages", () => {
    it("devuelve los mensajes en orden cronológico mostrando solo nombre y categoría del remitente", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      const older = new Date("2026-10-01T10:00:00");
      const newer = new Date("2026-10-01T10:05:00");
      // La base los devuelve del más nuevo al más viejo (order DESC + take).
      messages.find.mockResolvedValueOnce([
        { id: 2, content: "Llego 10 min antes", sentAt: newer, sender: fullPlayer({ id: 8, names: "Beto" }) },
        { id: 1, content: "Hola!", sentAt: older, sender: fullPlayer() },
      ]);

      const result = await getChatMessages(1);

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: 1,
            content: "Hola!",
            sentAt: older,
            sender: { id: 7, names: "Ana", lastnames: "Gómez", category: PlayerCategory.FOURTH },
          },
          {
            id: 2,
            content: "Llego 10 min antes",
            sentAt: newer,
            sender: { id: 8, names: "Beto", lastnames: "Gómez", category: PlayerCategory.FOURTH },
          },
        ],
      });
      expectNoPrivateData(result);
    });

    it("sigue mostrando los mensajes una vez finalizado el turno (solo lectura)", async () => {
      vi.setSystemTime(AT_BOOKING_END);
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      const sentAt = new Date("2026-10-01T18:10:00");
      messages.find.mockResolvedValueOnce([{ id: 1, content: "Hola!", sentAt, sender: fullPlayer() }]);

      const result = await getChatMessages(1);

      expect(result).toMatchObject({ success: true, data: [{ id: 1, content: "Hola!" }] });
    });

    it("rechaza a quien no está autenticado", async () => {
      mockSession(null);

      const result = await getChatMessages(1);

      expect(result).toEqual({ success: false, error: "No estás autenticado." });
      expect(messages.find).not.toHaveBeenCalled();
    });

    it("rechaza a un jugador que no participa del partido", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(0);

      const result = await getChatMessages(1);

      expect(result).toEqual({ success: false, error: "No tenés acceso a este chat." });
      expect(messages.find).not.toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("guarda el mensaje a nombre del jugador de la sesión y devuelve solo nombre y categoría", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());
      const sentAt = new Date("2026-10-01T10:00:00");
      messages.save.mockImplementationOnce(async (entity: object) => ({ ...entity, id: 5, sentAt }));

      const result = await sendMessage(1, "  Hola a todos  ");

      expect(messages.create).toHaveBeenCalledWith({
        chat: { id: 1 },
        sender: { id: 7 },
        content: "Hola a todos",
      });
      expect(result).toEqual({
        success: true,
        data: {
          id: 5,
          content: "Hola a todos",
          sentAt,
          sender: { id: 7, names: "Ana", lastnames: "Gómez", category: PlayerCategory.FOURTH },
        },
      });
      expectNoPrivateData(result);
    });

    it("rechaza mensajes vacíos o solo con espacios", async () => {
      for (const content of ["", "   \n "]) {
        const result = await sendMessage(1, content);
        expect(result).toEqual({ success: false, error: "Escribí un mensaje para enviarlo." });
      }
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza mensajes que superan el largo máximo", async () => {
      const result = await sendMessage(1, "a".repeat(CHAT_MESSAGE_MAX_LENGTH + 1));

      expect(result.success).toBe(false);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza a quien no está autenticado", async () => {
      mockSession(null);

      const result = await sendMessage(1, "Hola");

      expect(result).toEqual({ success: false, error: "No estás autenticado." });
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza a un jugador que no participa del partido", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(0);

      const result = await sendMessage(1, "Hola");

      expect(result).toEqual({ success: false, error: "No tenés acceso a este chat." });
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza a un jugador bloqueado", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer({ isBlocked: true }));
      matchPlayers.count.mockResolvedValueOnce(1);

      const result = await sendMessage(1, "Hola");

      expect(result.success).toBe(false);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza mensajes una vez finalizado el horario del turno (chat en solo lectura)", async () => {
      vi.setSystemTime(AT_BOOKING_END);
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());

      const result = await sendMessage(1, "Hola");

      expect(result).toEqual({
        success: false,
        error: "El chat se cerró porque el turno ya finalizó. Podés leer la conversación, pero no enviar mensajes nuevos.",
      });
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("rechaza mensajes si el turno fue cancelado (chat en solo lectura)", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking(BookingState.CANCELLED));

      const result = await sendMessage(1, "Hola");

      expect(result).toEqual({
        success: false,
        error: "El chat se cerró porque el turno fue cancelado. Podés leer la conversación, pero no enviar mensajes nuevos.",
      });
      expect(messages.save).not.toHaveBeenCalled();
    });

    it("devuelve un error genérico si falla el guardado", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());
      messages.save.mockRejectedValueOnce(new Error("db down"));

      const result = await sendMessage(1, "Hola");

      expect(result).toEqual({ success: false, error: "No se pudo enviar el mensaje." });
    });
  });

  describe("addPlayerToChat", () => {
    const CARO = { id: 9, names: "Caro" };

    /**
     * The inviter (Ana, id 7) participates in chat 1, whose match (id 2) is
     * loaded inside the transaction with the given confirmed players.
     */
    function arrange(options: { inviterPlayersCount?: number; otherPlayersCount?: number; needPlayers?: boolean } = {}) {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer()).mockResolvedValueOnce(fullPlayer(CARO));
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());
      matches.findOne.mockResolvedValueOnce({
        id: 2,
        needPlayers: options.needPlayers ?? true,
        matchPlayers: [
          { id: 30, playerId: 7, playersCount: options.inviterPlayersCount ?? 1 },
          ...(options.otherPlayersCount ? [{ id: 31, playerId: 8, playersCount: options.otherPlayersCount }] : []),
        ],
      });
    }

    it("adds a registered player found by email, taking a free spot", async () => {
      arrange({ otherPlayersCount: 1 });

      const result = await addPlayerToChat(1, "  Caro@Test.com ");

      expect(players.findOne).toHaveBeenLastCalledWith({
        where: { account: { email: "caro@test.com" } },
        relations: { account: true },
      });
      expect(matchPlayers.create).toHaveBeenCalledWith({ match: { id: 2 }, player: { id: 9 }, playersCount: 1 });
      expect(matchPlayers.save).toHaveBeenCalledTimes(1);
      expect(matches.update).not.toHaveBeenCalled();
      // Same notice as joining from the grid: the other players learn who joined.
      expect(notifyPlayerJoined).toHaveBeenCalledWith(3, 9);
      // Only name and category of the added player: never their email or phone.
      expect(result).toEqual({
        success: true,
        data: { id: 9, names: "Caro", lastnames: "Gómez", category: PlayerCategory.FOURTH },
      });
    });

    it("finds the player by phone number, ignoring spaces, dashes and parentheses", async () => {
      arrange();

      const result = await addPlayerToChat(1, "(221) 555-0101");

      expect(players.findOne).toHaveBeenLastCalledWith({
        where: { phoneNumber: "2215550101" },
        relations: { account: true },
      });
      expect(result.success).toBe(true);
    });

    it("stops looking for players when the added player completes the match", async () => {
      arrange({ otherPlayersCount: 2 });

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result.success).toBe(true);
      expect(matches.update).toHaveBeenCalledWith(2, { needPlayers: false });
    });

    it("replaces one of the inviter's companions instead of taking a free spot", async () => {
      arrange({ inviterPlayersCount: 2 });

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result.success).toBe(true);
      expect(matchPlayers.update).toHaveBeenCalledWith(30, { playersCount: 1 });
      expect(matchPlayers.create).toHaveBeenCalledWith({ match: { id: 2 }, player: { id: 9 }, playersCount: 1 });
      expect(matches.update).not.toHaveBeenCalled();
    });

    it("can replace a companion even if the match is no longer looking for players", async () => {
      arrange({ inviterPlayersCount: 2, otherPlayersCount: 2, needPlayers: false });

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result.success).toBe(true);
      expect(matchPlayers.update).toHaveBeenCalledWith(30, { playersCount: 1 });
    });

    it("rejects adding when there are neither free spots nor companions to replace", async () => {
      arrange({ otherPlayersCount: 3, needPlayers: false });

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({ success: false, error: "No quedan lugares libres en el partido." });
      expect(matchPlayers.save).not.toHaveBeenCalled();
      expect(notifyPlayerJoined).not.toHaveBeenCalled();
    });

    it("rejects a player who is already in the match", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer()).mockResolvedValueOnce(fullPlayer(CARO));
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());
      matches.findOne.mockResolvedValueOnce({
        id: 2,
        needPlayers: true,
        matchPlayers: [
          { id: 30, playerId: 7, playersCount: 1 },
          { id: 31, playerId: 9, playersCount: 1 },
        ],
      });

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({ success: false, error: "Ese jugador ya forma parte del partido." });
      expect(matchPlayers.save).not.toHaveBeenCalled();
    });

    it("rejects an empty identifier", async () => {
      const result = await addPlayerToChat(1, "   ");

      expect(result).toEqual({ success: false, error: "Ingresá el email o el teléfono del jugador." });
    });

    it("rejects an identifier that does not belong to a registered player", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer()).mockResolvedValueOnce(null);
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());

      const result = await addPlayerToChat(1, "nadie@test.com");

      expect(result).toEqual({
        success: false,
        error: "No encontramos un jugador registrado con ese email o teléfono.",
      });
    });

    it("rejects adding a blocked player", async () => {
      mockSession("ana@test.com");
      players.findOne
        .mockResolvedValueOnce(fullPlayer())
        .mockResolvedValueOnce(fullPlayer({ ...CARO, isBlocked: true }));
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking());

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({
        success: false,
        error: "Ese jugador se encuentra bloqueado y no puede sumarse a partidos.",
      });
    });

    it("rejects inviters who do not participate in the chat", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(0);

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({ success: false, error: "No tenés acceso a este chat." });
    });

    it("rejects blocked inviters", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer({ isBlocked: true }));
      matchPlayers.count.mockResolvedValueOnce(1);

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({
        success: false,
        error: "El usuario se encuentra bloqueado y no puede sumar jugadores.",
      });
    });

    it("rejects adding players once the chat is closed", async () => {
      mockSession("ana@test.com");
      players.findOne.mockResolvedValueOnce(fullPlayer());
      matchPlayers.count.mockResolvedValueOnce(1);
      chats.findOne.mockResolvedValueOnce(chatWithBooking(BookingState.CANCELLED));

      const result = await addPlayerToChat(1, "caro@test.com");

      expect(result).toEqual({ success: false, error: "El chat está cerrado: ya no se pueden sumar jugadores." });
    });
  });
});
