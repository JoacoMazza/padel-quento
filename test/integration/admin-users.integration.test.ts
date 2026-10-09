import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataSource } from "@/src/lib/db";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";
import {
  getPlayersAdmin,
  getPlayerRecordAdmin,
  blockPlayer,
  unblockPlayer,
  createPlayer,
} from "@/src/actions/player";
import { createCourt } from "@/src/actions/court";
import { createBooking, joinOpenMatch } from "@/src/actions/booking";
import { setBookingAttendance, setMatchPlayerAttendance } from "@/src/actions/attendance";
import { recordPointsMovement } from "@/src/actions/profile";
import { BookingState, Role } from "@/src/domain/enums";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── mock de sesión de admin ───────────────────────────────────────────────────
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as any);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("admin player actions (integración con Postgres real)", () => {
  beforeAll(() => {
    mockAdminSession();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("getPlayersAdmin lista los jugadores existentes", async () => {
    // crear un jugador para asegurar que hay al menos uno
    await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("lista"),
      password: "pass123",
      names: "Lista",
      lastnames: "Test",
    });

    mockAdminSession();
    const result = await getPlayersAdmin();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    // todos los items tienen isBlocked definido
    result.data.forEach((p) => expect(typeof p.isBlocked).toBe("boolean"));
    // los datos personales salen del jugador (heredados de Booker) y el email de la cuenta
    expect(result.data.find((p) => p.names === "Lista")).toMatchObject({
      lastnames: "Test",
      email: expect.stringContaining("@test.com"),
      phoneNumber: expect.stringMatching(/^221\d+$/),
    });
  });

  it("blockPlayer marca isBlocked = true en la BD", async () => {
    const created = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("bloquear"),
      password: "pass123",
      names: "Bloquear",
      lastnames: "Test",
    });
    if (!created.success) throw new Error("expected success creando jugador");
    const id = created.data.id;

    mockAdminSession();
    const blockResult = await blockPlayer(id);
    expect(blockResult).toEqual({ success: true, data: null });

    // verificar directamente en la BD
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository("Player") as any;
    const player = await repo.findOne({ where: { id }, relations: { account: true } });
    expect(player?.account.isBlocked).toBe(true);
  });

  it("unblockPlayer marca isBlocked = false en la BD", async () => {
    // crear un jugador y bloquearlo primero
    const created = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("desbloquear"),
      password: "pass123",
      names: "Desbloquear",
      lastnames: "Test",
    });
    if (!created.success) throw new Error("expected success creando jugador");
    const id = created.data.id;

    mockAdminSession();
    await blockPlayer(id);

    mockAdminSession();
    const unblockResult = await unblockPlayer(id);
    expect(unblockResult).toEqual({ success: true, data: null });

    // verificar directamente en la BD
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository("Player") as any;
    const player = await repo.findOne({ where: { id }, relations: { account: true } });
    expect(player?.account.isBlocked).toBe(false);
  });

  it("blockPlayer devuelve error si el jugador no existe", async () => {
    mockAdminSession();
    const result = await blockPlayer(999_999_999);
    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });

  it("unblockPlayer devuelve error si el jugador no existe", async () => {
    mockAdminSession();
    const result = await unblockPlayer(999_999_999);
    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });
  it("getPlayerRecordAdmin devuelve el historial de reservas, inasistencias y puntos del jugador", async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const courtId = court.data.id;

    const created = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("ficha"),
      password: "pass123",
      names: "Ficha",
      lastnames: "Test",
    });
    const other = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("ficha.otro"),
      password: "pass123",
      names: "Otro",
      lastnames: "Test",
    });
    if (!created.success || !other.success) throw new Error("expected success creando jugadores");
    const id = created.data.id;

    // Turno común reservado por el jugador, al que faltó.
    const base = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    base.setHours(8, 0, 0, 0);
    const ownBooking = await createBooking({
      fromDateTime: base,
      bookingState: BookingState.RESERVED,
      bookerId: id,
      courtId,
    });
    if (!ownBooking.success) throw new Error("expected success creando turno");
    mockAdminSession();
    await setBookingAttendance(ownBooking.data.id, false);

    // Partido abierto de otro jugador al que se sumó y también faltó.
    const otherMatch = await createBooking({
      fromDateTime: new Date(base.getTime() + 3 * 60 * 60_000),
      groupSize: 2,
      bookerId: other.data.id,
      courtId,
    });
    if (!otherMatch.success) throw new Error("expected success creando partido");
    const joined = await joinOpenMatch({ bookingId: otherMatch.data.id, playerId: id });
    if (!joined.success) throw new Error("expected success sumándose al partido");
    const dataSource = await getDataSource();
    const matchPlayer = await dataSource.getRepository<MatchPlayer>("MatchPlayer").findOne({
      where: { player: { id }, match: { booking: { id: otherMatch.data.id } } },
    });
    if (!matchPlayer) throw new Error("expected the player to be in the match");
    mockAdminSession();
    await setMatchPlayerAttendance(matchPlayer.id, false);

    // Turno de otro jugador en el que no participa: no debe aparecer.
    await createBooking({
      fromDateTime: new Date(base.getTime() + 6 * 60 * 60_000),
      bookingState: BookingState.RESERVED,
      bookerId: other.data.id,
      courtId,
    });

    await recordPointsMovement(id, 20, "bonus", "Asistencia a turno reservado");

    mockAdminSession();
    const result = await getPlayerRecordAdmin(id);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      id,
      names: "Ficha",
      email: created.data.account.email,
      scoring: 20,
      isBlocked: false,
      noShows: 2,
    });
    expect(result.data.bookings.map((b) => b.id)).toEqual([otherMatch.data.id, ownBooking.data.id]);
    expect(result.data.bookings[0]).toMatchObject({ isOpenMatch: true, attended: false });
    expect(result.data.bookings[1]).toMatchObject({
      isOpenMatch: false,
      attended: false,
      courtNumber: court.data.number,
    });
    expect(result.data.movements).toEqual([
      expect.objectContaining({ amount: 20, description: "Asistencia a turno reservado" }),
    ]);
  });

  it("getPlayerRecordAdmin devuelve error si el jugador no existe", async () => {
    mockAdminSession();
    const result = await getPlayerRecordAdmin(999_999_999);
    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });
});

