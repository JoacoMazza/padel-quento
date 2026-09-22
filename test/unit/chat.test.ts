import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

const { chats, players, matchPlayers, messages, getDataSource } = vi.hoisted(() => {
  const chats = { findOne: vi.fn() };
  const players = { findOne: vi.fn() };
  const matchPlayers = { count: vi.fn() };
  const messages = {
    find: vi.fn(),
    create: vi.fn((entity: unknown) => entity),
    save: vi.fn(),
  };
  const repositories: Record<string, unknown> = {
    Chat: chats,
    Player: players,
    MatchPlayer: matchPlayers,
    Message: messages,
  };
  const getRepository = vi.fn((name: string) => repositories[name]);
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { chats, players, matchPlayers, messages, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { getServerSession } from "next-auth/next";
import { PlayerCategory } from "@/src/domain/enums";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/src/domain/constants";
import { getChatById, getChatMessages, sendMessage } from "@/src/actions/chat";

// Jugador tal como lo devuelve la base: con todos sus datos de contacto y privados.
function fullPlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    email: "ana@test.com",
    phoneNumber: "+54 221 555-0101",
    dni: 30111222,
    passwordHash: "$2b$10$hash",
    names: "Ana",
    lastnames: "Gómez",
    category: PlayerCategory.FOURTH,
    isBlocked: false,
    ...overrides,
  };
}

const PRIVATE_KEYS = ["email", "phoneNumber", "dni", "passwordHash"];

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

function chatWithBooking() {
  return { id: 1, match: { id: 2, booking: { fromDateTime: BOOKING_START, durationMinutes: 90 } } };
}

describe("chat actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    messages.create.mockImplementation((entity: unknown) => entity);
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
          booking: { fromDateTime, durationMinutes: 90, court: { number: 3 } },
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
          booking: { fromDateTime, courtNumber: 3 },
          participants: [{ id: 7, names: "Ana", lastnames: "Gómez", category: PlayerCategory.FOURTH }],
          isClosed: false,
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

      expect(result).toMatchObject({ success: true, data: { id: 1, isClosed: true } });
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
});
