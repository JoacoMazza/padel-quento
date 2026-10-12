import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch, updateBooking } from "@/src/actions/booking";
import { addPlayerToChat, getChatById, getChatMessages, joinChatMatch, sendMessage } from "@/src/actions/chat";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

// En minúsculas, como quedan guardados los emails al registrarse.
function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`.toLowerCase();
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
    const court = await createCourt({
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
    const booking = await createBooking({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatch({ bookingId: booking.data.id, playerId: beto.id });
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
    const court = await createCourt({
      number: uniqueCourtNumber(),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const ana = await newPlayer("Ana");
    const beto = await newPlayer("Beto");

    const fromDateTime = new Date(Date.now() + 41 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBooking({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatch({ bookingId: booking.data.id, playerId: beto.id });
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
    const court = await createCourt({
      number: uniqueCourtNumber(),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const ana = await newPlayer("Ana");
    const beto = await newPlayer("Beto");

    const fromDateTime = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBooking({ fromDateTime, bookerId: ana.bookerId, courtId: court.data.id, groupSize: 1 });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    const joined = await joinOpenMatch({ bookingId: booking.data.id, playerId: beto.id });
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

  describe("sharing the chat room", () => {
    let dayOffset = 50;

    /**
     * Open match created by a new player with the given group size, plus a second
     * player who joins alone: that join is what creates the chat room.
     */
    async function openMatchChat(groupSize: number) {
      const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
      if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
      const creator = await newPlayer("Creador");
      const second = await newPlayer("Segundo");

      const fromDateTime = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
      dayOffset += 1;
      fromDateTime.setHours(9, 0, 0, 0);
      const booking = await createBooking({ fromDateTime, bookerId: creator.bookerId, courtId: court.data.id, groupSize });
      if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
      const joined = await joinOpenMatch({ bookingId: booking.data.id, playerId: second.id });
      if (!joined.success) throw new Error("no se pudo sumar al segundo jugador");
      const found = await getBookingById(booking.data.id);
      if (!found.success || !found.data?.match?.chat) throw new Error("no se creó la sala de chat");

      return { creator, second, bookingId: booking.data.id, chatId: found.data.match.chat.id };
    }

    async function matchState(bookingId: number) {
      const found = await getBookingById(bookingId);
      if (!found.success || !found.data?.match) throw new Error("expected match");
      return {
        needPlayers: found.data.match.needPlayers,
        players: Object.fromEntries(found.data.match.matchPlayers.map((mp) => [mp.playerId, mp.playersCount])),
      };
    }

    it("a registered player who opens the shared link joins the match and gets access to the chat", async () => {
      const { creator, second, bookingId, chatId } = await openMatchChat(1);
      const guest = await newPlayer("Invitado");

      actAs(guest.email);
      expect(await getChatMessages(chatId)).toEqual({ success: false, error: "No tenés acceso a este chat." });

      expect(await joinChatMatch(chatId)).toEqual({ success: true, data: null });

      expect((await sendMessage(chatId, "¡Me sumo!")).success).toBe(true);
      expect(await matchState(bookingId)).toEqual({
        needPlayers: true,
        players: { [creator.id]: 1, [second.id]: 1, [guest.id]: 1 },
      });
    });

    it("joining through the link fails once the match is full", async () => {
      const { chatId } = await openMatchChat(2);
      const fourth = await newPlayer("Cuarto");
      const fifth = await newPlayer("Quinto");

      actAs(fourth.email);
      expect((await joinChatMatch(chatId)).success).toBe(true);

      actAs(fifth.email);
      const result = await joinChatMatch(chatId);
      expect(result.success).toBe(false);
    });

    it("any participant can add a registered player by email, taking a free spot", async () => {
      const { creator, second, bookingId, chatId } = await openMatchChat(1);
      const added = await newPlayer("Agregado", { names: "Caro" });

      // Quien agrega no es el creador: cualquier participante puede hacerlo.
      actAs(second.email);
      const result = await addPlayerToChat(chatId, added.email.toUpperCase());
      expect(result).toEqual({
        success: true,
        data: { id: added.id, names: "Caro", lastnames: "Agregado", category: PlayerCategory.WITHOUT_CATEGORY },
      });
      expect(await matchState(bookingId)).toEqual({
        needPlayers: true,
        players: { [creator.id]: 1, [second.id]: 1, [added.id]: 1 },
      });

      actAs(added.email);
      expect((await getChatMessages(chatId)).success).toBe(true);
    });

    it("adding a player by phone replaces one of the inviter's companions without changing the total", async () => {
      const { creator, second, bookingId, chatId } = await openMatchChat(2);
      const companionPhone = uniquePhoneNumber();
      const companion = await newPlayer("Acompañante", { phoneNumber: companionPhone });

      actAs(creator.email);
      const result = await addPlayerToChat(chatId, companionPhone);
      expect(result.success).toBe(true);

      expect(await matchState(bookingId)).toEqual({
        needPlayers: true,
        players: { [creator.id]: 1, [second.id]: 1, [companion.id]: 1 },
      });
    });

    it("adding the player that completes the match stops the search for players", async () => {
      const { bookingId, chatId, creator } = await openMatchChat(1);
      const third = await newPlayer("Tercero");
      const fourth = await newPlayer("Cuarto");

      actAs(creator.email);
      expect((await addPlayerToChat(chatId, third.email)).success).toBe(true);
      expect((await addPlayerToChat(chatId, fourth.email)).success).toBe(true);

      expect((await matchState(bookingId)).needPlayers).toBe(false);
      const fifth = await newPlayer("Quinto");
      expect(await addPlayerToChat(chatId, fifth.email)).toEqual({
        success: false,
        error: "No quedan lugares libres en el partido.",
      });
    });

    it("rejects adding someone who is not a registered player or is already in the match", async () => {
      const { creator, chatId } = await openMatchChat(1);

      actAs(creator.email);
      expect(await addPlayerToChat(chatId, "nadie.registrado@test.com")).toEqual({
        success: false,
        error: "No encontramos un jugador registrado con ese email o teléfono.",
      });
      expect(await addPlayerToChat(chatId, creator.email)).toEqual({
        success: false,
        error: "Ese jugador ya forma parte del partido.",
      });
    });

    it("a player outside the match cannot add players", async () => {
      const { chatId } = await openMatchChat(1);
      const outsider = await newPlayer("Ajeno");
      const target = await newPlayer("Objetivo");

      actAs(outsider.email);
      expect(await addPlayerToChat(chatId, target.email)).toEqual({
        success: false,
        error: "No tenés acceso a este chat.",
      });
    });
  });
});
