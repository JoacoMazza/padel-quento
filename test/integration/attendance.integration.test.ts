import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { BookingState, Role } from "@/src/domain/enums";
import { ATTENDANCE_POINTS, OPEN_MATCH_MIN_HOURS_BEFORE_START } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch } from "@/src/actions/booking";
import { getProfileData } from "@/src/actions/profile";
import {
  setBookingAttendance,
  setMatchPlayerAttendance,
  awardAttendancePoints,
} from "@/src/actions/attendance";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// Siempre en el futuro y con horario propio por test, igual que en
// match.integration.test.ts: la antelación mínima de partidos abiertos compara
// contra la hora real, y el backend rechaza solapamientos para la misma cancha.
let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setHours(8, 0, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

// Turnos ya finalizados (para probar awardAttendancePoints sin fake timers):
// cada test necesita su propio horario en el pasado, separado por más de la
// duración del turno, para no solapar entre sí en la misma cancha.
let pastSlotOffset = 0;
function uniquePastFromDateTime() {
  const date = new Date(Date.now() - (3 * 60 + pastSlotOffset * 120) * 60_000);
  pastSlotOffset += 1;
  return date;
}

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as any);
}

function mockPlayerSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
  } as any);
}

describe("attendance actions (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createTestPlayer(prefix: string) {
    const email = uniqueEmail(prefix);
    const player = await createPlayer({
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: player.data.id, email };
  }

  describe("setBookingAttendance", () => {
    it("marca la asistencia de un turno sin partido abierto", async () => {
      const player = await createTestPlayer("asistencia-simple");
      const created = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      mockAdminSession();
      const result = await setBookingAttendance(created.data.id, false);

      expect(result).toEqual({ success: true, data: expect.objectContaining({ attended: false }) });

      const found = await getBookingById(created.data.id);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.attended).toBe(false);
    });

    it("devuelve error si el turno tiene un partido abierto asociado", async () => {
      const player = await createTestPlayer("asistencia-abierto");
      const created = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        playerId: player.id,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");

      mockAdminSession();
      const result = await setBookingAttendance(created.data.id, false);

      expect(result).toEqual({
        success: false,
        error: "Este turno es un partido abierto: marcá la asistencia de cada jugador por separado.",
      });
    });

    it("devuelve error si el turno no existe", async () => {
      mockAdminSession();
      const result = await setBookingAttendance(999_999_999, false);
      expect(result).toEqual({ success: false, error: "El turno no existe." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      const player = await createTestPlayer("asistencia-no-admin");
      const created = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      mockPlayerSession();
      const result = await setBookingAttendance(created.data.id, false);

      expect(result.success).toBe(false);
    });
  });

  describe("setMatchPlayerAttendance", () => {
    it("marca la asistencia de un jugador puntual de un partido abierto", async () => {
      const creator = await createTestPlayer("mp-creador");
      const created = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        playerId: creator.id,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");

      const found = await getBookingById(created.data.id);
      if (!found.success || !found.data?.match) throw new Error("expected match");
      const matchPlayerId = found.data.match.matchPlayers![0].id;

      mockAdminSession();
      const result = await setMatchPlayerAttendance(matchPlayerId, false);

      expect(result).toEqual({ success: true, data: expect.objectContaining({ attended: false }) });
    });

    it("devuelve error si el jugador del partido no existe", async () => {
      mockAdminSession();
      const result = await setMatchPlayerAttendance(999_999_999, false);
      expect(result).toEqual({ success: false, error: "El jugador no forma parte de este partido." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();
      const result = await setMatchPlayerAttendance(1, false);
      expect(result.success).toBe(false);
    });
  });

  describe("awardAttendancePoints", () => {
    it("acredita los puntos al jugador de un turno simple ya finalizado", async () => {
      const player = await createTestPlayer("puntos-simple");
      const past = uniquePastFromDateTime();
      const created = await createBooking({
        fromDateTime: past,
        durationMinutes: 90,
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      const result = await awardAttendancePoints();
      expect(result.success).toBe(true);

      const found = await getBookingById(created.data.id);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.pointsAwarded).toBe(true);

      const profile = await getProfileData(player.email);
      expect(profile?.scoring).toBe(ATTENDANCE_POINTS);
    });

    it("no acredita puntos si el turno fue marcado como ausente antes de finalizar", async () => {
      const player = await createTestPlayer("puntos-ausente");
      const past = uniquePastFromDateTime();
      const created = await createBooking({
        fromDateTime: past,
        durationMinutes: 90,
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      mockAdminSession();
      const marked = await setBookingAttendance(created.data.id, false);
      expect(marked.success).toBe(true);

      await awardAttendancePoints();

      const found = await getBookingById(created.data.id);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.pointsAwarded).toBe(true);

      const profile = await getProfileData(player.email);
      expect(profile?.scoring).toBe(0);
    });

    it("no procesa turnos cancelados ni turnos futuros", async () => {
      const player = await createTestPlayer("puntos-cancelado");
      const past = uniquePastFromDateTime();
      const cancelled = await createBooking({
        fromDateTime: past,
        durationMinutes: 90,
        playerId: player.id,
        courtId,
        bookingState: BookingState.CANCELLED,
      });
      if (!cancelled.success) throw new Error("expected success");

      const future = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        durationMinutes: 90,
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!future.success) throw new Error("expected success");

      await awardAttendancePoints();

      const foundCancelled = await getBookingById(cancelled.data.id);
      const foundFuture = await getBookingById(future.data.id);
      if (!foundCancelled.success || !foundFuture.success) throw new Error("expected success");
      expect(foundCancelled.data?.pointsAwarded).toBe(false);
      expect(foundFuture.data?.pointsAwarded).toBe(false);
    });

    it("no acredita puntos dos veces al correr el job otra vez sobre el mismo turno", async () => {
      const player = await createTestPlayer("puntos-idempotente");
      const past = uniquePastFromDateTime();
      const created = await createBooking({
        fromDateTime: past,
        durationMinutes: 90,
        playerId: player.id,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      await awardAttendancePoints();
      const secondRun = await awardAttendancePoints();

      // No se afirma un "data" global exacto: en la suite completa corren en
      // paralelo otros archivos de test contra la misma base y pueden tener
      // turnos propios ya finalizados pendientes de procesar. Lo que importa
      // acá es que a ESTE jugador no se le acredite el punto dos veces.
      expect(secondRun.success).toBe(true);

      const profile = await getProfileData(player.email);
      expect(profile?.scoring).toBe(ATTENDANCE_POINTS);
    });

    it("acredita puntos solo a los jugadores del partido abierto que no fueron marcados ausentes", async () => {
      const creator = await createTestPlayer("partido-creador");
      const joiner = await createTestPlayer("partido-sumado");

      // Horario cercano (no a 30 días, como uniqueFromDateTime): el fake timer de
      // abajo solo necesita saltar unas horas para que el turno termine, sin
      // arrastrar de paso los turnos "a 30 días" que crean otros tests de este
      // archivo (que seguirían sin finalizar en ese momento simulado).
      const startTime = new Date(Date.now() + (OPEN_MATCH_MIN_HOURS_BEFORE_START + 1) * 60 * 60_000);
      const created = await createBooking({
        fromDateTime: startTime,
        playerId: creator.id,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");

      const joined = await joinOpenMatch({ bookingId: created.data.id, playerId: joiner.id, groupSize: 2 });
      if (!joined.success) throw new Error("expected success");

      const found = await getBookingById(created.data.id);
      if (!found.success || !found.data?.match) throw new Error("expected match");
      const matchPlayers = found.data.match.matchPlayers!;
      const joinerMatchPlayer = matchPlayers.find((mp) => mp.playerId === joiner.id);
      if (!joinerMatchPlayer) throw new Error("expected joiner match player");

      mockAdminSession();
      const marked = await setMatchPlayerAttendance(joinerMatchPlayer.id, false);
      expect(marked.success).toBe(true);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() + 91 * 60_000));

      const result = await awardAttendancePoints();
      vi.useRealTimers();

      // Ídem: no se afirma un "data" global exacto (ver comentario en el test
      // de idempotencia), solo que el jugador ausente no cobra y el presente sí.
      expect(result.success).toBe(true);

      const creatorProfile = await getProfileData(creator.email);
      const joinerProfile = await getProfileData(joiner.email);
      expect(creatorProfile?.scoring).toBe(ATTENDANCE_POINTS);
      expect(joinerProfile?.scoring).toBe(0);
    });
  });
});
