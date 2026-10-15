import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { PlayerCategory } from "@/src/domain/enums";
import { createPlayer } from "@/src/actions/player";
import { getBookingById } from "@/src/actions/booking";
import { addPlayerToMatch } from "@/src/actions/match";
import { getChatMessages } from "@/src/actions/chat";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

// En minúsculas, como quedan guardados los emails al registrarse.
function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`.toLowerCase();
}

function actAs(email: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email } } as never);
}

describe("addPlayerToMatch (integración con Postgres real)", () => {
  let courtId: number;
  let dayOffset = 60;

  async function newPlayer(prefix: string, overrides: Record<string, unknown> = {}) {
    const email = uniqueEmail(prefix);
    const player = await createPlayer({
      // Los partidos abiertos exigen categoría: todos comparten la misma, salvo que la sobreescriban.
      category: PlayerCategory.FOURTH,
      phoneNumber: uniquePhoneNumber(),
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
      ...overrides,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { email, id: player.data.id };
  }

  /** Open match just created by a new player, with only its creator (and companions): no chat room yet. */
  async function newOpenMatch(groupSize: number) {
    const creator = await newPlayer("Creador");
    const fromDateTime = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    dayOffset += 1;
    fromDateTime.setHours(9, 0, 0, 0);
    const booking = await createBookingForPlayer({ fromDateTime, bookerId: creator.id, courtId, groupSize });
    if (!booking.success) throw new Error("no se pudo crear el turno de prueba");
    return { creator, bookingId: booking.data.id };
  }

  async function matchState(bookingId: number) {
    const found = await getBookingById(bookingId);
    if (!found.success || !found.data?.match) throw new Error("expected match");
    return {
      needPlayers: found.data.match.needPlayers,
      players: Object.fromEntries(found.data.match.matchPlayers.map((mp) => [mp.playerId, mp.playersCount])),
      hasChat: Boolean(found.data.match.chat),
    };
  }

  beforeAll(async () => {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it("the creator adds a registered player by email right after creating the match, before any chat exists", async () => {
    const { creator, bookingId } = await newOpenMatch(1);
    const added = await newPlayer("Agregado", { names: "Caro" });
    expect((await matchState(bookingId)).hasChat).toBe(false);

    actAs(creator.email);
    const result = await addPlayerToMatch(bookingId, added.email.toUpperCase());

    expect(result).toEqual({
      success: true,
      data: { id: added.id, names: "Caro", lastnames: "Agregado", category: PlayerCategory.FOURTH },
    });
    expect(await matchState(bookingId)).toMatchObject({
      needPlayers: true,
      players: { [creator.id]: 1, [added.id]: 1 },
      // Second member with an account: the match chat room is created, as when joining from the grid.
      hasChat: true,
    });

    actAs(added.email);
    const found = await getBookingById(bookingId);
    if (!found.success || !found.data?.match?.chat) throw new Error("expected chat");
    expect((await getChatMessages(found.data.match.chat.id)).success).toBe(true);
  });

  it("rejects adding a player of a different category than the creator, without adding them", async () => {
    const { creator, bookingId } = await newOpenMatch(1);
    const added = await newPlayer("OtraCategoria", { category: PlayerCategory.SECOND });

    actAs(creator.email);
    const result = await addPlayerToMatch(bookingId, added.email);

    expect(result).toEqual({ success: false, error: "Este partido es para jugadores de 4ª Categoría." });
    expect((await matchState(bookingId)).players).toEqual({ [creator.id]: 1 });
  });

  it("rejects adding a player without a category, without adding them", async () => {
    const { creator, bookingId } = await newOpenMatch(1);
    const added = await newPlayer("SinCategoria", { category: PlayerCategory.WITHOUT_CATEGORY });

    actAs(creator.email);
    const result = await addPlayerToMatch(bookingId, added.email);

    expect(result).toEqual({
      success: false,
      error: "Ese jugador todavía no cargó su categoría en su perfil, así que no se puede sumar a un partido abierto.",
    });
    expect((await matchState(bookingId)).players).toEqual({ [creator.id]: 1 });
  });

  it("any member can add players, not only the creator", async () => {
    const { creator, bookingId } = await newOpenMatch(1);
    const joiner = await newPlayer("Sumado");
    const added = await newPlayer("Agregado");
    const joined = await joinOpenMatchForPlayer({ bookingId, playerId: joiner.id });
    if (!joined.success) throw new Error("no se pudo sumar al jugador");

    actAs(joiner.email);
    expect((await addPlayerToMatch(bookingId, added.email)).success).toBe(true);

    expect((await matchState(bookingId)).players).toEqual({ [creator.id]: 1, [joiner.id]: 1, [added.id]: 1 });
    // The added player gets access to the chat room like any other member.
    actAs(added.email);
    const found = await getBookingById(bookingId);
    if (!found.success || !found.data?.match?.chat) throw new Error("expected chat");
    expect((await getChatMessages(found.data.match.chat.id)).success).toBe(true);
  });

  it("adding a player by phone replaces one of the inviter's companions without changing the total", async () => {
    const { creator, bookingId } = await newOpenMatch(3);
    const companionPhone = uniquePhoneNumber();
    const companion = await newPlayer("Acompañante", { phoneNumber: companionPhone });

    actAs(creator.email);
    expect((await addPlayerToMatch(bookingId, companionPhone)).success).toBe(true);

    expect(await matchState(bookingId)).toMatchObject({
      needPlayers: true,
      players: { [creator.id]: 2, [companion.id]: 1 },
    });
  });

  it("adding the player that completes the match stops the search for players", async () => {
    const { creator, bookingId } = await newOpenMatch(1);
    const second = await newPlayer("Segundo");
    const third = await newPlayer("Tercero");
    const fourth = await newPlayer("Cuarto");
    const fifth = await newPlayer("Quinto");

    actAs(creator.email);
    for (const player of [second, third, fourth]) {
      expect((await addPlayerToMatch(bookingId, player.email)).success).toBe(true);
    }

    expect((await matchState(bookingId)).needPlayers).toBe(false);
    expect(await addPlayerToMatch(bookingId, fifth.email)).toEqual({
      success: false,
      error: "No quedan lugares libres en el partido.",
    });
  });

  it("rejects adding someone who is not a registered player or is already in the match", async () => {
    const { creator, bookingId } = await newOpenMatch(1);

    actAs(creator.email);
    expect(await addPlayerToMatch(bookingId, "nadie.registrado@test.com")).toEqual({
      success: false,
      error: "No encontramos un jugador registrado con ese email o teléfono.",
    });
    expect(await addPlayerToMatch(bookingId, creator.email)).toEqual({
      success: false,
      error: "Ese jugador ya forma parte del partido.",
    });
  });

  it("a player who is not a member of the match cannot add players", async () => {
    const { bookingId } = await newOpenMatch(1);
    const outsider = await newPlayer("Ajeno");
    const target = await newPlayer("Objetivo");

    actAs(outsider.email);
    expect(await addPlayerToMatch(bookingId, target.email)).toEqual({
      success: false,
      error: "No formás parte de este partido.",
    });
    expect(Object.keys((await matchState(bookingId)).players)).toHaveLength(1);
  });
});
