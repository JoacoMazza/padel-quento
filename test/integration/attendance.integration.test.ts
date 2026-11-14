import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { BookingState, Role, PlayerCategory } from "@/src/domain/enums";
import {
  ATTENDANCE_POINTS,
  OPEN_MATCH_JOIN_BONUS_POINTS,
  OPEN_MATCH_MIN_HOURS_BEFORE_START,
  PENALTY_POINTS,
} from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { createPlayer } from "@/src/actions/player";
import { getBookingById } from "@/src/actions/booking";
import { getProfileData, recordPointsMovement } from "@/src/actions/profile";
import {
  setBookingAttendance,
  setMatchPlayerAttendance,
  awardAttendancePoints,
} from "@/src/actions/attendance";
import { createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";

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
  } as never);
}

function mockPlayerSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
  } as never);
}

describe("attendance actions (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
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
      category: PlayerCategory.FOURTH,
      phoneNumber: uniquePhoneNumber(),
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: player.data.id, bookerId: player.data.id, email };
  }

  /** Movimientos de puntos ligados a un turno (penalties.booking_id), del más viejo al más nuevo. */
  async function movementsOf(bookingId: number) {
    const dataSource = await getDataSource();
    const rows: { player_id: number; penalized_scoring: number; reason: string }[] = await dataSource.query(
      `SELECT "player_id", "penalized_scoring", "reason" FROM "penalties" WHERE "booking_id" = $1 ORDER BY "id"`,
      [bookingId],
    );
    return rows.map((row) => ({ playerId: row.player_id, points: Number(row.penalized_scoring), reason: row.reason }));
  }

  async function scoringOf(email: string) {
    return (await getProfileData(email))?.scoring;
  }

  describe("setBookingAttendance", () => {
    it("marcar ausente a quien reservó le descuenta la penalización en el momento, ligada al turno", async () => {
      const player = await createTestPlayer("asistencia-simple");
      await recordPointsMovement(player.id, 50, "bonus", "Puntos iniciales de prueba");
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        bookerId: player.bookerId,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      mockAdminSession();
      const result = await setBookingAttendance(created.data.id, false);

      expect(result).toEqual({ success: true, data: { id: created.data.id, attended: false } });
      expect(await movementsOf(created.data.id)).toEqual([
        { playerId: player.id, points: -PENALTY_POINTS, reason: "Inasistencia a turno reservado" },
      ]);
      expect(await scoringOf(player.email)).toBe(50 - PENALTY_POINTS);
    });

    it("volver a marcarlo presente borra la penalización y le devuelve los puntos", async () => {
      const player = await createTestPlayer("asistencia-corregida");
      await recordPointsMovement(player.id, 50, "bonus", "Puntos iniciales de prueba");
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        bookerId: player.bookerId,
        courtId,
      });
      if (!created.success) throw new Error("expected success");

      mockAdminSession();
      await setBookingAttendance(created.data.id, false);
      // Marcarlo ausente dos veces no lo penaliza dos veces.
      await setBookingAttendance(created.data.id, false);
      expect(await movementsOf(created.data.id)).toHaveLength(1);

      const result = await setBookingAttendance(created.data.id, true);

      expect(result).toEqual({ success: true, data: { id: created.data.id, attended: true } });
      expect(await movementsOf(created.data.id)).toEqual([]);
      expect(await scoringOf(player.email)).toBe(50);
    });

    it("devuelve error si el turno tiene un partido abierto asociado", async () => {
      const player = await createTestPlayer("asistencia-abierto");
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        bookerId: player.bookerId,
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
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        bookerId: player.bookerId,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      mockPlayerSession();
      const result = await setBookingAttendance(created.data.id, false);

      expect(result.success).toBe(false);
      expect(await movementsOf(created.data.id)).toEqual([]);
    });
  });

  describe("setMatchPlayerAttendance", () => {
    async function openMatchWithJoiner(prefix: string) {
      const creator = await createTestPlayer(`${prefix}-creador`);
      const joiner = await createTestPlayer(`${prefix}-sumado`);
      await recordPointsMovement(joiner.id, 100, "bonus", "Puntos iniciales de prueba");
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        bookerId: creator.bookerId,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");
      // Se suma con un acompañante: su grupo es de 2.
      const joined = await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: joiner.id, groupSize: 2 });
      if (!joined.success) throw new Error("expected success");
      const found = await getBookingById(created.data.id);
      if (!found.success || !found.data?.match) throw new Error("expected match");
      const joinerMatchPlayer = found.data.match.matchPlayers!.find((mp) => mp.playerId === joiner.id)!;
      return { bookingId: created.data.id, joiner, joinerMatchPlayer };
    }

    it("de entrada asistió todo el grupo de cada jugador", async () => {
      const { joinerMatchPlayer } = await openMatchWithJoiner("mp-inicial");

      expect(joinerMatchPlayer).toMatchObject({ playersCount: 2, attendedCount: 2, pointsAwarded: 0 });
    });

    it("cada ausente del grupo penaliza a quien lo sumó, ligado al turno; corregirlo recalcula la penalización", async () => {
      const { bookingId, joiner, joinerMatchPlayer } = await openMatchWithJoiner("mp-ausentes");

      mockAdminSession();
      const oneAbsent = await setMatchPlayerAttendance(joinerMatchPlayer.id, 1);
      expect(oneAbsent).toEqual({ success: true, data: { id: joinerMatchPlayer.id, attendedCount: 1 } });
      expect(await movementsOf(bookingId)).toEqual([
        { playerId: joiner.id, points: -PENALTY_POINTS, reason: "Inasistencia a turno reservado" },
      ]);

      await setMatchPlayerAttendance(joinerMatchPlayer.id, 0);
      expect(await movementsOf(bookingId)).toEqual([
        { playerId: joiner.id, points: -2 * PENALTY_POINTS, reason: "Inasistencia a turno reservado" },
      ]);
      expect(await scoringOf(joiner.email)).toBe(100 - 2 * PENALTY_POINTS);

      await setMatchPlayerAttendance(joinerMatchPlayer.id, 2);
      expect(await movementsOf(bookingId)).toEqual([]);
      expect(await scoringOf(joiner.email)).toBe(100);
    });

    it("rechaza una cantidad de asistentes fuera del grupo", async () => {
      const { joinerMatchPlayer } = await openMatchWithJoiner("mp-fuera-de-rango");

      mockAdminSession();
      for (const count of [-1, 3, 1.5]) {
        expect(await setMatchPlayerAttendance(joinerMatchPlayer.id, count)).toEqual({
          success: false,
          error: "La cantidad de asistentes tiene que ser de 0 a 2.",
        });
      }
    });

    it("devuelve error si el jugador del partido no existe", async () => {
      mockAdminSession();
      const result = await setMatchPlayerAttendance(999_999_999, 0);
      expect(result).toEqual({ success: false, error: "El jugador no forma parte de este partido." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();
      const result = await setMatchPlayerAttendance(1, 0);
      expect(result.success).toBe(false);
    });
  });

  describe("awardAttendancePoints", () => {
    it("acredita los puntos al jugador de un turno simple ya finalizado y lo da por finalizado", async () => {
      const player = await createTestPlayer("puntos-simple");
      const past = uniquePastFromDateTime();
      const created = await createBookingForPlayer({
        fromDateTime: past,
        durationMinutes: 90,
        bookerId: player.bookerId,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!created.success) throw new Error("expected success");

      const result = await awardAttendancePoints();
      expect(result.success).toBe(true);

      const found = await getBookingById(created.data.id);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.FINISHED);
      expect(await movementsOf(created.data.id)).toEqual([
        { playerId: player.id, points: ATTENDANCE_POINTS, reason: "Asistencia a turno reservado" },
      ]);
      expect(await scoringOf(player.email)).toBe(ATTENDANCE_POINTS);
    });

    it("no acredita puntos a quien fue marcado ausente: solo queda la penalización", async () => {
      const player = await createTestPlayer("puntos-ausente");
      // Con saldo 0 no habría nada que descontar (el piso es 0).
      await recordPointsMovement(player.id, 50, "bonus", "Puntos iniciales de prueba");
      const past = uniquePastFromDateTime();
      const created = await createBookingForPlayer({
        fromDateTime: past,
        durationMinutes: 90,
        bookerId: player.bookerId,
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
      expect(found.data?.bookingState).toBe(BookingState.FINISHED);
      expect(await scoringOf(player.email)).toBe(50 - PENALTY_POINTS);
    });

    it("no procesa turnos cancelados ni turnos futuros", async () => {
      const player = await createTestPlayer("puntos-cancelado");
      const past = uniquePastFromDateTime();
      const cancelled = await createBookingForPlayer({
        fromDateTime: past,
        durationMinutes: 90,
        bookerId: player.bookerId,
        courtId,
        bookingState: BookingState.CANCELLED,
      });
      if (!cancelled.success) throw new Error("expected success");

      const future = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        durationMinutes: 90,
        bookerId: player.bookerId,
        courtId,
        bookingState: BookingState.RESERVED,
      });
      if (!future.success) throw new Error("expected success");

      await awardAttendancePoints();

      const foundCancelled = await getBookingById(cancelled.data.id);
      const foundFuture = await getBookingById(future.data.id);
      if (!foundCancelled.success || !foundFuture.success) throw new Error("expected success");
      expect(foundCancelled.data?.bookingState).toBe(BookingState.CANCELLED);
      expect(foundFuture.data?.bookingState).toBe(BookingState.RESERVED);
      expect(await scoringOf(player.email)).toBe(0);
    });

    it("no acredita puntos dos veces al correr el job otra vez sobre el mismo turno", async () => {
      const player = await createTestPlayer("puntos-idempotente");
      const past = uniquePastFromDateTime();
      const created = await createBookingForPlayer({
        fromDateTime: past,
        durationMinutes: 90,
        bookerId: player.bookerId,
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
      expect(await scoringOf(player.email)).toBe(ATTENDANCE_POINTS);
    });

    it("acredita puntos a los jugadores presentes del partido abierto y guarda lo acreditado a cada uno", async () => {
      const creator = await createTestPlayer("partido-creador");
      const joiner = await createTestPlayer("partido-sumado");
      await recordPointsMovement(joiner.id, 50, "bonus", "Puntos iniciales de prueba");

      // Horario cercano (no a 30 días, como uniqueFromDateTime): el fake timer de
      // abajo solo necesita saltar unas horas para que el turno termine, sin
      // arrastrar de paso los turnos "a 30 días" que crean otros tests de este
      // archivo (que seguirían sin finalizar en ese momento simulado).
      const startTime = new Date(Date.now() + (OPEN_MATCH_MIN_HOURS_BEFORE_START + 1) * 60 * 60_000);
      const created = await createBookingForPlayer({
        fromDateTime: startTime,
        bookerId: creator.bookerId,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");

      const joined = await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: joiner.id, groupSize: 1 });
      if (!joined.success) throw new Error("expected success");

      const found = await getBookingById(created.data.id);
      if (!found.success || !found.data?.match) throw new Error("expected match");
      const joinerMatchPlayer = found.data.match.matchPlayers!.find((mp) => mp.playerId === joiner.id);
      if (!joinerMatchPlayer) throw new Error("expected joiner match player");

      mockAdminSession();
      const marked = await setMatchPlayerAttendance(joinerMatchPlayer.id, 0);
      expect(marked.success).toBe(true);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() + 91 * 60_000));

      const result = await awardAttendancePoints();
      vi.useRealTimers();

      // Ídem: no se afirma un "data" global exacto (ver comentario en el test
      // de idempotencia), solo que el jugador ausente es penalizado y el presente cobra.
      expect(result.success).toBe(true);
      expect(await scoringOf(creator.email)).toBe(ATTENDANCE_POINTS);
      expect(await scoringOf(joiner.email)).toBe(50 - PENALTY_POINTS);

      const after = await getBookingById(created.data.id);
      if (!after.success || !after.data?.match) throw new Error("expected match");
      expect(after.data.bookingState).toBe(BookingState.FINISHED);
      const awarded = Object.fromEntries(after.data.match.matchPlayers!.map((mp) => [mp.playerId, mp.pointsAwarded]));
      expect(awarded).toEqual({ [creator.id]: ATTENDANCE_POINTS, [joiner.id]: 0 });
    });

    it("acredita el bonus extra a quien se sumó a un partido abierto y asistió, pero no al creador", async () => {
      const creator = await createTestPlayer("bonus-creador");
      const joiner = await createTestPlayer("bonus-sumado");

      // Mismo esquema de horario cercano + fake timer que el test anterior. Se
      // desplaza unas horas más para no solapar con ese turno en la misma cancha.
      const startTime = new Date(Date.now() + (OPEN_MATCH_MIN_HOURS_BEFORE_START + 3) * 60 * 60_000);
      const created = await createBookingForPlayer({
        fromDateTime: startTime,
        bookerId: creator.bookerId,
        courtId,
        groupSize: 2,
      });
      if (!created.success) throw new Error("expected success");

      const joined = await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: joiner.id, groupSize: 2 });
      if (!joined.success) throw new Error("expected success");

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() + 91 * 60_000));

      const result = await awardAttendancePoints();
      vi.useRealTimers();

      expect(result.success).toBe(true);
      expect(await scoringOf(creator.email)).toBe(ATTENDANCE_POINTS);
      expect(await scoringOf(joiner.email)).toBe(ATTENDANCE_POINTS + OPEN_MATCH_JOIN_BONUS_POINTS);
    });
  });
});
