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
  closeOpenMatch,
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

    it("con groupSize menor a 4 crea un partido abierto y registra al creador con esa cantidad de jugadores", async () => {
      const result = await createBooking({
        fromDateTime,
        groupSize: 2,
        playerId: 1,
        courtId: 2,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingState: BookingState.PENDING_PLAYERS }),
      );
      expect(create).toHaveBeenCalledWith({
        booking: { id: undefined },
        player: { id: 1 },
        playersCount: 2,
      });
      expect(save).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("con groupSize 4 crea una reserva completa (no un partido abierto) y no registra participantes", async () => {
      const result = await createBooking({ fromDateTime, groupSize: 4, playerId: 1, courtId: 2 });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingState: BookingState.RESERVED }),
      );
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("no registra participantes para una reserva sin groupSize", async () => {
      await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(save).toHaveBeenCalledTimes(1);
    });

    it("rechaza un groupSize fuera del rango 1 a 4", async () => {
      const tooLow = await createBooking({ fromDateTime, groupSize: 0, playerId: 1, courtId: 2 });
      const tooHigh = await createBooking({ fromDateTime, groupSize: 5, playerId: 1, courtId: 2 });

      expect(tooLow).toEqual({
        success: false,
        error: "La cantidad de jugadores debe ser entre 1 y 4.",
      });
      expect(tooHigh).toEqual({
        success: false,
        error: "La cantidad de jugadores debe ser entre 1 y 4.",
      });
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("getBookings", () => {
    it("devuelve todas las reservas con jugador y cancha", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getBookings();

      expect(find).toHaveBeenCalledWith({
        relations: { player: true, court: true, participants: true },
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
        relations: { player: true, court: true, participants: true },
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

  describe("closeOpenMatch", () => {
    it("cierra manualmente un partido abierto con 1, 2 o 3 jugadores confirmados", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        bookingState: BookingState.PENDING_PLAYERS,
        participants: [{ playersCount: 2 }],
      });

      const result = await closeOpenMatch(1);

      expect(result).toEqual({
        success: true,
        data: { id: 1, bookingState: BookingState.RESERVED, participants: [{ playersCount: 2 }] },
      });
    });

    it("devuelve error si la reserva no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await closeOpenMatch(999);

      expect(result).toEqual({ success: false, error: "La reserva no existe." });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve error si el turno no está pendiente de jugadores", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        bookingState: BookingState.RESERVED,
        participants: [{ playersCount: 4 }],
      });

      const result = await closeOpenMatch(1);

      expect(result).toEqual({
        success: false,
        error: "Este turno no es un partido abierto pendiente de jugadores.",
      });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve error si ya están los 4 jugadores confirmados", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        bookingState: BookingState.PENDING_PLAYERS,
        participants: [{ playersCount: 4 }],
      });

      const result = await closeOpenMatch(1);

      expect(result).toEqual({
        success: false,
        error: "El cierre manual solo está disponible con entre 1 y 3 jugadores confirmados.",
      });
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
