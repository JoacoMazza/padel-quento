import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createPlayer } from "@/src/actions/player";
import { getBookingById, updateBooking } from "@/src/actions/booking";
import { closeFinishedChats, getChatById, getChatMessages, sendMessage } from "@/src/actions/chat";
import type { Chat } from "@/src/entities/Chat";
import { createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

function actAs(email: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email } } as never);
}

describe("chat actions (integración con Postgres real)", () => {
  let chatId: number;
  let anaEmail: string;
  let betoEmail: string;
  let outsiderEmail: string;
  let anaId: number;

  async function newPlayer(prefix: string, overrides: Record<string, unknown> = {}) {
    const email = uniqueEmail(prefix);
    const player = await createPlayer({
      category: PlayerCategory.FOURTH,
      phoneNumber: uniquePhoneNumber(),
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
      ...overrides,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { email, id: player.data.id, bookerId: player.data.id };
  }

  beforeAll(async () => {
    const court = await createTestCourt({
      number: uniqueCourtNumber(),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");

    const ana = await newPlayer("Ana", { names: "Ana", category: PlayerCategory.FOURTH });
    const beto = await newPlayer("Beto", { names: "Beto" });
    const outsider = await newPlayer("Ajeno");
    anaEmail = ana.email;
    anaId = ana.id;
    betoEmail = beto.email;
    outsiderEmail = outsider.email;

    const fromDateTime = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBookingForPlayer({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatchForPlayer({ bookingId: booking.data.id, playerId: beto.id });
    if (!joined.success) throw new Error("no se pudo sumar al segundo jugador");

    const found = await getBookingById(booking.data.id);
    if (!found.success || !found.data?.match?.chat) throw new Error("no se creó la sala de chat");
    chatId = found.data.match.chat.id;
  });

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("los mensajes muestran solo nombre y categoría del remitente, sin teléfono ni email", async () => {
    actAs(anaEmail);
    const sent = await sendMessage(chatId, "Hola, ¿quién trae las pelotas?");
    expect(sent.success).toBe(true);

    actAs(betoEmail);
    const result = await getChatMessages(chatId);
    if (!result.success) throw new Error("expected success");

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      content: "Hola, ¿quién trae las pelotas?",
      sender: { id: anaId, names: "Ana", lastnames: "Ana", category: PlayerCategory.FOURTH },
    });
    expect(Object.keys(result.data[0].sender).sort()).toEqual(["category", "id", "lastnames", "names"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("555-0101");
    expect(serialized).not.toContain("@test.com");
    expect(serialized).not.toContain("passwordHash");
  });

  it("la sala tampoco expone datos de contacto de los participantes", async () => {
    const result = await getChatById(chatId);
    if (!result.success || !result.data) throw new Error("expected success");

    expect(result.data.participants).toHaveLength(2);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("555-0101");
    expect(serialized).not.toContain("@test.com");
  });

  it("un jugador ajeno al partido no puede leer ni escribir en la sala", async () => {
    actAs(outsiderEmail);

    expect(await getChatMessages(chatId)).toEqual({ success: false, error: "No tenés acceso a este chat." });
    expect(await sendMessage(chatId, "Me cuelgo")).toEqual({
      success: false,
      error: "No tenés acceso a este chat.",
    });
  });

  it("una vez finalizado el horario del turno la sala queda en solo lectura", async () => {
    const court = await createTestCourt({
      number: uniqueCourtNumber(),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const ana = await newPlayer("Ana");
    const beto = await newPlayer("Beto");

    const fromDateTime = new Date(Date.now() + 41 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBookingForPlayer({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatchForPlayer({ bookingId: booking.data.id, playerId: beto.id });
    if (!joined.success) throw new Error("no se pudo sumar al segundo jugador");
    const found = await getBookingById(booking.data.id);
    if (!found.success || !found.data?.match?.chat) throw new Error("no se creó la sala de chat");
    const closingChatId = found.data.match.chat.id;

    // Con el turno por delante la sala está abierta y se puede escribir.
    actAs(ana.email);
    expect((await sendMessage(closingChatId, "Nos vemos en la cancha")).success).toBe(true);
    const open = await getChatById(closingChatId);
    expect(open).toMatchObject({ success: true, data: { isClosed: false } });

    // El turno terminó hace un rato (ya pasaron los 90 minutos de duración).
    const dataSource = await getDataSource();
    await dataSource
      .getRepository("Booking")
      .update(booking.data.id, { fromDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000) });

    const closed = await getChatById(closingChatId);
    expect(closed).toMatchObject({ success: true, data: { isClosed: true } });

    const rejected = await sendMessage(closingChatId, "¿Llegaron bien?");
    expect(rejected).toEqual({
      success: false,
      error: "El chat se cerró porque el turno ya finalizó. Podés leer la conversación, pero no enviar mensajes nuevos.",
    });

    // La conversación se conserva y sigue siendo legible para los participantes.
    actAs(beto.email);
    const history = await getChatMessages(closingChatId);
    if (!history.success) throw new Error("expected success");
    expect(history.data.map((message) => message.content)).toEqual(["Nos vemos en la cancha"]);
  });

  it("al cancelar el turno la sala queda en solo lectura y conserva el historial", async () => {
    const court = await createTestCourt({
      number: uniqueCourtNumber(),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const ana = await newPlayer("Ana");
    const beto = await newPlayer("Beto");

    const fromDateTime = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBookingForPlayer({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatchForPlayer({ bookingId: booking.data.id, playerId: beto.id });
    if (!joined.success) throw new Error("no se pudo sumar al segundo jugador");
    const found = await getBookingById(booking.data.id);
    if (!found.success || !found.data?.match?.chat) throw new Error("no se creó la sala de chat");
    const cancelledChatId = found.data.match.chat.id;

    actAs(ana.email);
    expect((await sendMessage(cancelledChatId, "Nos vemos en la cancha")).success).toBe(true);

    const cancelled = await updateBooking(booking.data.id, { bookingState: BookingState.CANCELLED });
    expect(cancelled.success).toBe(true);

    const closed = await getChatById(cancelledChatId);
    expect(closed).toMatchObject({ success: true, data: { isClosed: true, closedReason: "cancelled" } });

    const rejected = await sendMessage(cancelledChatId, "¿Se suspendió?");
    expect(rejected).toEqual({
      success: false,
      error: "El chat se cerró porque el turno fue cancelado. Podés leer la conversación, pero no enviar mensajes nuevos.",
    });

    actAs(beto.email);
    const history = await getChatMessages(cancelledChatId);
    if (!history.success) throw new Error("expected success");
    expect(history.data.map((message) => message.content)).toEqual(["Nos vemos en la cancha"]);
  });
  describe("closeFinishedChats (cierre de la sala al terminar el turno)", () => {
    async function createChat(daysAhead: number) {
      const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
      if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
      const ana = await newPlayer("Ana");
      const beto = await newPlayer("Beto");
      const fromDateTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
      fromDateTime.setHours(9, 0, 0, 0);
      const booking = await createBookingForPlayer({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
      if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
      const joined = await joinOpenMatchForPlayer({ bookingId: booking.data.id, playerId: beto.id });
      if (!joined.success) throw new Error("no se pudo sumar al segundo jugador");
      const found = await getBookingById(booking.data.id);
      if (!found.success || !found.data?.match?.chat) throw new Error("no se creó la sala de chat");
      return { bookingId: booking.data.id, chatId: found.data.match.chat.id };
    }

    async function isOpen(id: number) {
      const dataSource = await getDataSource();
      const chat = await dataSource.getRepository<Chat>("Chat").findOneByOrFail({ id });
      return chat.isOpen;
    }

    it("la sala se crea abierta", async () => {
      const { chatId: createdChatId } = await createChat(43);

      expect(await isOpen(createdChatId)).toBe(true);
    });

    it("cierra la sala de un partido cuyo turno ya terminó y deja abierta la de uno futuro", async () => {
      const ended = await createChat(44);
      const upcoming = await createChat(45);
      const dataSource = await getDataSource();
      await dataSource
        .getRepository("Booking")
        .update(ended.bookingId, { fromDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000) });

      const result = await closeFinishedChats();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBeGreaterThanOrEqual(1);
      expect(await isOpen(ended.chatId)).toBe(false);
      expect(await isOpen(upcoming.chatId)).toBe(true);
    });

    it("no cierra la sala mientras el turno está en juego", async () => {
      const playing = await createChat(46);
      const dataSource = await getDataSource();
      // Empezó hace 30 minutos y dura 90: todavía no terminó.
      await dataSource
        .getRepository("Booking")
        .update(playing.bookingId, { fromDateTime: new Date(Date.now() - 30 * 60 * 1000) });

      await closeFinishedChats();

      expect(await isOpen(playing.chatId)).toBe(true);
    });

    it("cierra la sala de un turno cancelado", async () => {
      const cancelledMatch = await createChat(47);
      const cancelled = await updateBooking(cancelledMatch.bookingId, { bookingState: BookingState.CANCELLED });
      expect(cancelled.success).toBe(true);

      await closeFinishedChats();

      expect(await isOpen(cancelledMatch.chatId)).toBe(false);
    });

    it("no vuelve a contar las salas ya cerradas", async () => {
      const ended = await createChat(48);
      const dataSource = await getDataSource();
      await dataSource
        .getRepository("Booking")
        .update(ended.bookingId, { fromDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000) });
      await closeFinishedChats();

      const secondRun = await closeFinishedChats();

      expect(secondRun).toEqual({ success: true, data: 0 });
    });
  });
});
