import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch } from "@/src/actions/booking";
import { getChatById, getChatMessages, sendMessage } from "@/src/actions/chat";

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
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
      phoneNumber: "+54 221 555-0101",
      dni: 30111222,
      ...overrides,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { email, id: player.data.id };
  }

  beforeAll(async () => {
    const court = await createCourt({
      number: Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000),
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
    const booking = await createBooking({ fromDateTime, playerId: ana.id, courtId: court.data.id, groupSize: 1 });
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
      number: Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000),
      price: 10000,
    });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const ana = await newPlayer("Ana");
    const beto = await newPlayer("Beto");

    const fromDateTime = new Date(Date.now() + 41 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBooking({ fromDateTime, playerId: ana.id, courtId: court.data.id, groupSize: 1 });
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
});
