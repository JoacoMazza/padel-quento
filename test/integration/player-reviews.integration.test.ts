import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, PlayerCategory, ReviewLevel, Role } from "@/src/domain/enums";
import { reviewInviteNotice, type NotificationMessage, type NotificationRecipient } from "@/src/domain/notifications";
import { getDataSource } from "@/src/lib/db";
import { getReputations } from "@/src/lib/player-reviews";
import { Booking } from "@/src/entities/Booking";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { createCourt } from "@/src/actions/court";
import {
  changePlayerCategoryAdmin,
  createPlayer,
  deductPlayerPointsAdmin,
  getPlayerRecordAdmin,
} from "@/src/actions/player";
import { getBookingById } from "@/src/actions/booking";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { awardAttendancePoints } from "@/src/actions/attendance";
import { getReviewableTeammates, submitPlayerReview } from "@/src/actions/review";
import { recordPointsMovement } from "@/src/actions/profile";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

type NotifyCall = [NotificationRecipient[], (recipient: NotificationRecipient) => NotificationMessage];

type TestPlayer = { id: number; names: string; email: string; phoneNumber: string };

function signedInAs(player: TestPlayer | null, role = Role.PLAYER) {
  vi.mocked(getServerSession).mockResolvedValue(player ? ({ user: { email: player.email, role } } as never) : null);
}

function asAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: "admin@test.com", role: Role.ADMIN } } as never);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

const answers = { level: ReviewLevel.AS_DECLARED, goodAttitude: true, onTime: true };

describe("reseñas entre compañeros de partido (integración con Postgres real)", () => {
  let courtId: number;
  let ana: TestPlayer;
  let bruno: TestPlayer;
  let carla: TestPlayer;
  let dario: TestPlayer;

  async function newPlayer(names: string): Promise<TestPlayer> {
    const email = uniqueEmail(names.toLowerCase());
    const phoneNumber = uniquePhoneNumber();
    // Todos de la misma categoría: para crear o sumarse a un partido abierto hace falta tenerla cargada y que coincida (#54).
    const created = await createPlayer({
      email,
      phoneNumber,
      password: "secreto123",
      names,
      lastnames: "Resena",
      category: PlayerCategory.FIFTH,
    });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: created.data.id, names, email, phoneNumber };
  }

  /**
   * Partido abierto de Ana con Bruno y Carla que terminó `hoursAgo` horas atrás:
   * se crea a futuro (las reglas de reserva lo exigen) y se lleva al pasado.
   */
  let slot = 0;
  async function playedMatch(hoursAgo = 1) {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    future.setHours(8 + (slot++ % 12), 0, 0, 0);
    future.setDate(future.getDate() + Math.floor(slot / 12));
    const created = await createBookingForPlayer({ fromDateTime: future, courtId, groupSize: 1, bookerId: ana.id });
    if (!created.success) throw new Error(created.error);
    await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: bruno.id });
    await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: carla.id });

    const dataSource = await getDataSource();
    const start = new Date(Date.now() - hoursAgo * 60 * 60_000 - 90 * 60_000);
    await dataSource.getRepository<Booking>("Booking").update(created.data.id, { fromDateTime: start });
    const found = await getBookingById(created.data.id);
    if (!found.success || !found.data?.match) throw new Error("se esperaba un partido");
    return { bookingId: created.data.id, matchId: found.data.match.id };
  }

  async function markAbsent(matchId: number, player: TestPlayer) {
    const dataSource = await getDataSource();
    await dataSource
      .getRepository<MatchPlayer>("MatchPlayer")
      .update({ match: { id: matchId }, player: { id: player.id } }, { attended: false });
  }

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
    ana = await newPlayer("Ana");
    bruno = await newPlayer("Bruno");
    carla = await newPlayer("Carla");
    dario = await newPlayer("Dario");
  });

  beforeEach(() => {
    notify.mockClear();
    vi.mocked(getServerSession).mockReset();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("a quién puedo calificar", () => {
    it("lista a los compañeros del partido, sin incluirme, y marca a quién ya califiqué", async () => {
      const { matchId } = await playedMatch();
      signedInAs(ana);
      await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      const result = await getReviewableTeammates(matchId);

      if (!result.success) throw new Error(result.error);
      expect(result.data.map((t) => [t.name, t.alreadyReviewed]).sort()).toEqual([
        ["Bruno Resena", true],
        ["Carla Resena", false],
      ]);
    });

    it("no lista a quien no asistió", async () => {
      const { matchId } = await playedMatch();
      await markAbsent(matchId, carla);
      signedInAs(ana);

      const result = await getReviewableTeammates(matchId);

      expect(result.success && result.data.map((t) => t.name)).toEqual(["Bruno Resena"]);
    });
  });

  describe("dejar una reseña", () => {
    it("guarda la reseña del jugador de la sesión sobre su compañero", async () => {
      const { matchId } = await playedMatch();
      signedInAs(ana);

      const result = await submitPlayerReview({
        matchId,
        reviewedPlayerId: bruno.id,
        level: ReviewLevel.LOWER,
        goodAttitude: true,
        onTime: false,
        comment: "Llegó 20 minutos tarde",
      });

      expect(result).toEqual({ success: true, data: null });
      asAdmin();
      const record = await getPlayerRecordAdmin(bruno.id);
      if (!record.success) throw new Error(record.error);
      const review = record.data.reviews.find((r) => r.comment === "Llegó 20 minutos tarde");
      expect(review).toMatchObject({
        reviewerName: "Ana Resena",
        level: ReviewLevel.LOWER,
        goodAttitude: true,
        onTime: false,
      });
    });

    it.each([
      ["sin sesión", async () => signedInAs(null), "Tenés que iniciar sesión para calificar."],
      ["quien no jugó el partido", async () => signedInAs(dario), "Solo podés calificar a compañeros de un partido que jugaste."],
    ])("rechaza a %s", async (_, setup, error) => {
      const { matchId } = await playedMatch();
      await setup();

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      expect(result).toEqual({ success: false, error });
    });

    it("rechaza calificarse a uno mismo", async () => {
      const { matchId } = await playedMatch();
      signedInAs(ana);

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: ana.id, ...answers });

      expect(result).toEqual({ success: false, error: "No podés calificarte a vos mismo." });
    });

    it("rechaza calificar a alguien que no jugó ese partido o no asistió", async () => {
      const { matchId } = await playedMatch();
      await markAbsent(matchId, carla);
      signedInAs(ana);

      expect(await submitPlayerReview({ matchId, reviewedPlayerId: dario.id, ...answers })).toEqual({
        success: false,
        error: "Solo podés calificar a compañeros que jugaron el partido.",
      });
      expect(await submitPlayerReview({ matchId, reviewedPlayerId: carla.id, ...answers })).toEqual({
        success: false,
        error: "Solo podés calificar a compañeros que jugaron el partido.",
      });
    });

    it("rechaza calificar si quien califica no asistió", async () => {
      const { matchId } = await playedMatch();
      await markAbsent(matchId, ana);
      signedInAs(ana);

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      expect(result).toEqual({ success: false, error: "Solo podés calificar a compañeros de un partido que jugaste." });
    });

    it("solo se puede calificar hasta 48 horas después del partido", async () => {
      const { matchId } = await playedMatch(49);
      signedInAs(ana);

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      expect(result).toEqual({ success: false, error: "Ya pasaron las 48 horas para calificar este partido." });
    });

    it("no se puede calificar un partido cancelado", async () => {
      const { bookingId, matchId } = await playedMatch();
      const dataSource = await getDataSource();
      await dataSource.getRepository<Booking>("Booking").update(bookingId, { bookingState: BookingState.CANCELLED });
      signedInAs(ana);

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      expect(result).toEqual({ success: false, error: "Este partido no se puede calificar." });
    });

    it("no se puede calificar dos veces al mismo compañero en el mismo partido", async () => {
      const { matchId } = await playedMatch();
      signedInAs(ana);
      await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      const again = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers });

      expect(again).toEqual({ success: false, error: "Ya calificaste a este jugador en este partido." });
    });

    it("rechaza comentarios de más de 500 caracteres", async () => {
      const { matchId } = await playedMatch();
      signedInAs(ana);

      const result = await submitPlayerReview({ matchId, reviewedPlayerId: bruno.id, ...answers, comment: "x".repeat(501) });

      expect(result).toEqual({ success: false, error: "El comentario puede tener hasta 500 caracteres." });
    });
  });

  describe("reputación", () => {
    it("resume las reseñas recibidas en porcentajes", async () => {
      const elena = await newPlayer("Elena");
      const fede = await newPlayer("Fede");
      const gaby = await newPlayer("Gaby");
      const dataSource = await getDataSource();
      // Elena juega con Fede y Gaby: cada uno la califica en un partido distinto.
      for (const [reviewer, onTime] of [
        [fede, true],
        [gaby, false],
        [fede, true],
      ] as const) {
        const future = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000);
        future.setHours(8 + (slot++ % 12), 0, 0, 0);
        future.setDate(future.getDate() + Math.floor(slot / 12));
        const created = await createBookingForPlayer({ fromDateTime: future, courtId, groupSize: 2, bookerId: elena.id });
        if (!created.success) throw new Error(created.error);
        await joinOpenMatchForPlayer({ bookingId: created.data.id, playerId: reviewer.id });
        signedInAs(reviewer);
        await dataSource
          .getRepository<Booking>("Booking")
          .update(created.data.id, { fromDateTime: new Date(Date.now() - 3 * 60 * 60_000) });
        const found = await getBookingById(created.data.id);
        const matchId = found.success ? found.data!.match!.id : 0;
        await submitPlayerReview({ matchId, reviewedPlayerId: elena.id, ...answers, onTime });
      }

      const reputations = await getReputations([elena.id, dario.id]);

      expect(reputations.get(elena.id)).toMatchObject({ reviews: 3, enough: true, onTimePct: 67, goodAttitudePct: 100 });
      expect(reputations.get(dario.id)).toMatchObject({ reviews: 0, enough: false });
    });
  });

  describe("aviso para calificar", () => {
    it("al terminar el partido invita a calificar a los que asistieron, una sola vez", async () => {
      // Los partidos de los otros tests también terminaron: se procesan antes para medir solo este.
      await awardAttendancePoints();
      const { matchId } = await playedMatch();
      await markAbsent(matchId, carla);
      notify.mockClear();

      await awardAttendancePoints();
      await awardAttendancePoints();

      const invites = (notify.mock.calls as unknown as NotifyCall[]).filter(([, build]) =>
        build({ names: "X", email: null, phoneNumber: null }).subject.includes("calificar"),
      );
      expect(invites).toHaveLength(1);
      const [recipients, buildMessage] = invites[0];
      expect(recipients.map((r) => r.names).sort()).toEqual(["Ana", "Bruno"]);
      const message = buildMessage(recipients[0]);
      expect(message.subject).toBe(reviewInviteNotice("Ana", { fromDateTime: new Date(), courtNumber: 1 }).subject);
    });
  });

  describe("herramientas del admin", () => {
    it("cambia la categoría de un jugador", async () => {
      asAdmin();

      const result = await changePlayerCategoryAdmin(dario.id, PlayerCategory.FOURTH);

      expect(result).toEqual({ success: true, data: null });
      const record = await getPlayerRecordAdmin(dario.id);
      expect(record.success && record.data.category).toBe(PlayerCategory.FOURTH);
    });

    it("descuenta puntos con un motivo que queda en el historial del jugador", async () => {
      await recordPointsMovement(dario.id, 30, "bonus", "Puntos de prueba");
      asAdmin();

      const result = await deductPlayerPointsAdmin(dario.id, 15, "Mala conducta reportada por compañeros");

      expect(result).toEqual({ success: true, data: null });
      const record = await getPlayerRecordAdmin(dario.id);
      if (!record.success) throw new Error(record.error);
      expect(record.data.movements[0]).toMatchObject({
        amount: -15,
        description: "Mala conducta reportada por compañeros",
      });
      expect(record.data.scoring).toBe(15);
    });

    it("valida los puntos y el motivo", async () => {
      asAdmin();

      expect(await deductPlayerPointsAdmin(dario.id, 0, "Motivo")).toEqual({
        success: false,
        error: "Indicá una cantidad de puntos mayor a 0.",
      });
      expect(await deductPlayerPointsAdmin(dario.id, 10, "  ")).toEqual({
        success: false,
        error: "Indicá el motivo del descuento.",
      });
    });

    it("solo un admin puede recategorizar o descontar puntos", async () => {
      signedInAs(ana);

      expect((await changePlayerCategoryAdmin(dario.id, PlayerCategory.FIRST)).success).toBe(false);
      expect((await deductPlayerPointsAdmin(dario.id, 10, "Motivo")).success).toBe(false);
    });

    it("la ficha del admin muestra la reputación y sus alertas", async () => {
      asAdmin();

      const record = await getPlayerRecordAdmin(bruno.id);

      if (!record.success) throw new Error(record.error);
      expect(record.data.reputation.reviews).toBeGreaterThan(0);
      expect(Array.isArray(record.data.reputationAlerts)).toBe(true);
    });
  });
});
