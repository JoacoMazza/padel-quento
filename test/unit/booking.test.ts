import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState } from "@/src/domain/enums";

const { create, save, find, findOne, merge, deleteFn, getOne, queryFn, getDataSource } = vi.hoisted(
  () => {
    const create = vi.fn((data: unknown) => data);
    const save = vi.fn(async (entity: unknown) => entity);
    const find = vi.fn();
    const findOne = vi.fn();
    const merge = vi.fn((entity: any, dto: any) => Object.assign(entity, dto));
    const deleteFn = vi.fn();
    const getOne = vi.fn(async () => null as unknown);
    const queryFn = vi.fn(async () => undefined);

    const repository = { create, save, find, findOne, merge, delete: deleteFn };

    const queryBuilder: any = {};
    queryBuilder.where = vi.fn(() => queryBuilder);
    queryBuilder.andWhere = vi.fn(() => queryBuilder);
    queryBuilder.getOne = getOne;

    const manager = {
      query: queryFn,
      getRepository: vi.fn(() => repository),
      createQueryBuilder: vi.fn(() => queryBuilder),
    };

    const getRepository = vi.fn(() => repository);
    const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
    const getDataSource = vi.fn(async () => ({ getRepository, transaction }));

    return { create, save, find, findOne, merge, deleteFn, getOne, queryFn, getDataSource };
  },
);

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  joinOpenMatch,
} from "@/src/actions/booking";

const DOUBLE_BOOKING_MESSAGE = "Ese horario ya está reservado para esta cancha.";
const fromDateTime = new Date("2026-01-01T10:00:00Z");

describe("booking actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
    getOne.mockResolvedValue(null);
  });

  describe("createBooking", () => {
    it("crea una reserva con los valores por defecto", async () => {
      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(create).toHaveBeenCalledWith({
        fromDateTime,
        durationMinutes: 90,
        bookingState: BookingState.RESERVED,
        player: { id: 1 },
        court: { id: 2 },
      });
      expect(result).toEqual({
        success: true,
        data: {
          fromDateTime,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          player: { id: 1 },
          court: { id: 2 },
        },
      });
    });

    it("respeta la duración y el estado indicados", async () => {
      await createBooking({
        fromDateTime,
        durationMinutes: 60,
        bookingState: BookingState.PAID,
        playerId: 1,
        courtId: 2,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ durationMinutes: 60, bookingState: BookingState.PAID }),
      );
    });

    it("toma un lock por cancha antes de chequear solapamientos", async () => {
      await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(queryFn).toHaveBeenCalledWith(expect.stringContaining("pg_advisory_xact_lock"), [2]);
    });

    it("devuelve error y no crea nada si el horario ya está reservado", async () => {
      getOne.mockResolvedValueOnce({ id: 99 });

      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(result).toEqual({ success: false, error: DOUBLE_BOOKING_MESSAGE });
      expect(create).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it("no valida solapamiento cuando la reserva se crea directamente cancelada", async () => {
      const result = await createBooking({
        fromDateTime,
        bookingState: BookingState.CANCELLED,
        playerId: 1,
        courtId: 2,
      });

      expect(getOne).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("devuelve un error genérico si falla el guardado", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(result).toEqual({ success: false, error: "No se pudo crear la reserva." });
    });

    it("sin isOpenMatch crea una reserva completa y no crea ningún Match", async () => {
      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(create).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.bookingState).toBe(BookingState.RESERVED);
    });

    it("con isOpenMatch crea la reserva pendiente de jugadores, un Match y anota al creador como primer jugador", async () => {
      const result = await createBooking({
        fromDateTime,
        isOpenMatch: true,
        playerId: 1,
        courtId: 2,
      });

      expect(create).toHaveBeenNthCalledWith(1, {
        fromDateTime,
        durationMinutes: 90,
        bookingState: BookingState.PENDING_PLAYERS,
        player: { id: 1 },
        court: { id: 2 },
      });
      expect(create).toHaveBeenNthCalledWith(2, { booking: { id: undefined }, needsPlayers: true });
      expect(create).toHaveBeenNthCalledWith(3, { match: { id: undefined }, player: { id: 1 } });
      expect(save).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.bookingState).toBe(BookingState.PENDING_PLAYERS);
    });
  });

  describe("joinOpenMatch", () => {
    it("suma un jugador nuevo a un partido abierto sin completar el cupo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({
        id: 20,
        needsPlayers: true,
        matchPlayers: [{ matchId: 20, playerId: 1 }, { matchId: 20, playerId: 2 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(create).toHaveBeenCalledWith({ match: { id: 20 }, player: { id: 5 } });
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.bookingState).toBe(BookingState.PENDING_PLAYERS);
    });

    it("toma un lock por partido antes de buscarlo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({ id: 20, needsPlayers: true, matchPlayers: [] });

      await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining("pg_advisory_xact_lock"),
        expect.arrayContaining([10]),
      );
    });

    it("si al sumarse se completa el cupo máximo, la reserva pasa a reservada y el match deja de necesitar jugadores", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({
        id: 20,
        needsPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(save).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.bookingState).toBe(BookingState.RESERVED);
    });

    it("rechaza si el turno no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await joinOpenMatch({ bookingId: 999, playerId: 5 });

      expect(result).toEqual({ success: false, error: "El turno no existe." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el turno no es un partido abierto", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Este turno no es un partido abierto." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el turno está pendiente de jugadores pero no tiene un Match asociado", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce(null);

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Este turno no es un partido abierto." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el jugador ya está anotado en el partido", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({ id: 20, needsPlayers: true, matchPlayers: [{ playerId: 5 }] });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Ya estás anotado en este partido." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el partido ya está completo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({
        id: 20,
        needsPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }, { playerId: 4 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({
        success: false,
        error: "El partido ya está completo, no quedan lugares libres.",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("devuelve un error genérico si falla el guardado", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.PENDING_PLAYERS });
      findOne.mockResolvedValueOnce({ id: 20, needsPlayers: true, matchPlayers: [] });
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "No se pudo sumar al partido." });
    });
  });

  describe("getBookings", () => {
    it("devuelve todas las reservas con jugador, cancha y partido", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getBookings();

      expect(find).toHaveBeenCalledWith({
        relations: { player: true, court: true, match: { matchPlayers: true } },
      });
      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getBookings();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener las reservas." });
    });
  });

  describe("getBookingById", () => {
    it("devuelve la reserva encontrada", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getBookingById(1);

      expect(findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { player: true, court: true, match: { matchPlayers: true } },
      });
      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getBookingById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updateBooking", () => {
    it("actualiza los campos escalares provistos", async () => {
      findOne.mockResolvedValueOnce({ id: 1, bookingState: BookingState.RESERVED });

      const result = await updateBooking(1, { bookingState: BookingState.CANCELLED });

      expect(result).toEqual({
        success: true,
        data: { id: 1, bookingState: BookingState.CANCELLED },
      });
    });

    it("no valida solapamiento al cancelar", async () => {
      findOne.mockResolvedValueOnce({ id: 1, bookingState: BookingState.RESERVED });

      await updateBooking(1, { bookingState: BookingState.CANCELLED });

      expect(getOne).not.toHaveBeenCalled();
    });

    it("reasigna jugador y cancha cuando se proveen", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        fromDateTime,
        durationMinutes: 90,
        bookingState: BookingState.RESERVED,
      });

      const result = await updateBooking(1, { playerId: 3, courtId: 4 });

      expect(result).toEqual({
        success: true,
        data: {
          id: 1,
          fromDateTime,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          player: { id: 3 },
          court: { id: 4 },
        },
      });
    });

    it("devuelve error y no guarda si el nuevo horario ya está reservado", async () => {
      findOne.mockResolvedValueOnce({ id: 1, court: { id: 4 }, bookingState: BookingState.RESERVED });
      getOne.mockResolvedValueOnce({ id: 5 });

      const result = await updateBooking(1, { fromDateTime });

      expect(result).toEqual({ success: false, error: DOUBLE_BOOKING_MESSAGE });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve error si la reserva no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updateBooking(999, { bookingState: BookingState.PAID });

      expect(result).toEqual({ success: false, error: "La reserva no existe." });
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("deleteBooking", () => {
    it("elimina la reserva", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deleteBooking(1);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si la reserva no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deleteBooking(999);

      expect(result).toEqual({ success: false, error: "La reserva no existe." });
    });
  });
});
