import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState } from "@/src/domain/enums";

const { create, save, update, find, findOne, playerFindOne, merge, deleteFn, getOne, queryFn, getDataSource } =
  vi.hoisted(() => {
    const create = vi.fn((data: unknown) => data);
    const save = vi.fn(async (entity: unknown) => entity);
    const update = vi.fn(async () => ({ affected: 1 }));
    const find = vi.fn();
    const findOne = vi.fn();
    const playerFindOne = vi.fn(async () => ({ id: 1, isBlocked: false }));
    const merge = vi.fn((entity: any, dto: any) => Object.assign(entity, dto));
    const deleteFn = vi.fn();
    const getOne = vi.fn(async () => null as unknown);
    const queryFn = vi.fn(async () => undefined);

    const repository = { create, save, update, find, findOne, merge, delete: deleteFn };
    const playerRepository = { create, save, update, find, findOne: playerFindOne, merge, delete: deleteFn };

    const queryBuilder: any = {};
    queryBuilder.where = vi.fn(() => queryBuilder);
    queryBuilder.andWhere = vi.fn(() => queryBuilder);
    queryBuilder.getOne = getOne;

    const getRepoForEntity = (entity: unknown) => (entity === "Player" ? playerRepository : repository);

    const manager = {
      query: queryFn,
      getRepository: vi.fn(getRepoForEntity),
      createQueryBuilder: vi.fn(() => queryBuilder),
    };

    const getRepository = vi.fn(getRepoForEntity);
    const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
    const getDataSource = vi.fn(async () => ({ getRepository, transaction }));

    return { create, save, update, find, findOne, playerFindOne, merge, deleteFn, getOne, queryFn, getDataSource };
  });

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
// Siempre en el futuro: la validación de antelación para partidos abiertos
// compara contra la hora real, así que una fecha fija terminaría quedando en
// el pasado con el correr del tiempo.
const fromDateTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

describe("booking actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
    getOne.mockResolvedValue(null);
    playerFindOne.mockResolvedValue({ id: 1, isBlocked: false });
    findOne.mockResolvedValue({ id: 2, price: 10000 });
  });

  describe("createBooking", () => {
    it("crea una reserva con los valores por defecto (tomando el precio de la cancha)", async () => {
      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(create).toHaveBeenCalledWith({
        fromDateTime,
        durationMinutes: 90,
        bookingState: BookingState.RESERVED,
        price: 10000,
        player: { id: 1 },
        court: { id: 2 },
      });
      expect(result).toEqual({
        success: true,
        data: {
          fromDateTime,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          price: 10000,
          player: { id: 1 },
          court: { id: 2 },
        },
      });
    });

    it("permite especificar un precio custom en el input", async () => {
      await createBooking({ fromDateTime, playerId: 1, courtId: 2, price: 15000 });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ price: 15000 }),
      );
    });

    it("falla si la cancha no tiene precio y no se provee en el input", async () => {
      findOne.mockResolvedValueOnce({ id: 2, price: undefined });

      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(result).toEqual({
        success: false,
        error: "El precio de la reserva es obligatorio y debe ser mayor a 0.",
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

    it("con groupSize menor a 4 crea el turno reservado y el partido abierto con el creador como primer jugador", async () => {
      const result = await createBooking({
        fromDateTime,
        groupSize: 2,
        playerId: 1,
        courtId: 2,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingState: BookingState.RESERVED }),
      );
      expect(create).toHaveBeenCalledWith({ booking: { id: undefined }, needPlayers: true });
      expect(create).toHaveBeenCalledWith({
        match: { id: undefined },
        player: { id: 1 },
        playersCount: 2,
      });
      expect(save).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.bookingState).toBe(BookingState.RESERVED);
    });

    it("con groupSize 4 crea una reserva completa (no un partido abierto) y no crea ningún partido", async () => {
      const result = await createBooking({ fromDateTime, groupSize: 4, playerId: 1, courtId: 2 });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ bookingState: BookingState.RESERVED }),
      );
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("no crea ningún partido para una reserva sin groupSize", async () => {
      await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(save).toHaveBeenCalledTimes(1);
    });

    it("rechaza la reserva si el usuario se encuentra bloqueado", async () => {
      playerFindOne.mockResolvedValueOnce({ id: 1, isBlocked: true });

      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(result).toEqual({
        success: false,
        error: "El usuario se encuentra bloqueado y no puede realizar reservas.",
      });
      expect(save).not.toHaveBeenCalled();
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

    it("rechaza crear un partido abierto con menos de 3 horas de anticipación", async () => {
      const soon = new Date(Date.now() + 2 * 60 * 60_000);

      const result = await createBooking({ fromDateTime: soon, groupSize: 2, playerId: 1, courtId: 2 });

      expect(result).toEqual({
        success: false,
        error: "No se puede crear un partido abierto con menos de 3 horas de anticipación.",
      });
      expect(save).not.toHaveBeenCalled();
    });

    it("permite crear un partido abierto con más de 3 horas de anticipación", async () => {
      const inTime = new Date(Date.now() + 4 * 60 * 60_000);

      const result = await createBooking({ fromDateTime: inTime, groupSize: 2, playerId: 1, courtId: 2 });

      expect(result.success).toBe(true);
    });

    it("permite crear una reserva completa (no partido abierto) con menos de 3 horas de anticipación", async () => {
      const soon = new Date(Date.now() + 30 * 60_000);

      const result = await createBooking({ fromDateTime: soon, groupSize: 4, playerId: 1, courtId: 2 });

      expect(result.success).toBe(true);
    });
  });

  describe("joinOpenMatch", () => {
    it("suma un jugador nuevo a un partido abierto sin completar el cupo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(create).toHaveBeenCalledWith({
        match: { id: 20 },
        player: { id: 5 },
        playersCount: 1,
      });
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("crea la sala de chat al sumarse el segundo jugador con cuenta propia", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        // Solo el creador confirmado hasta ahora: esta suma es la segunda cuenta.
        matchPlayers: [{ playerId: 1 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(create).toHaveBeenCalledWith({ match: { id: 20 } });
      expect(save).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("no crea otra sala de chat si el partido ya tenía más de un jugador confirmado", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }],
      });

      await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(create).not.toHaveBeenCalledWith({ match: { id: 20 } });
    });

    it("permite sumarse con acompañantes indicando groupSize", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5, groupSize: 2 });

      expect(create).toHaveBeenCalledWith({
        match: { id: 20 },
        player: { id: 5 },
        playersCount: 2,
      });
      expect(update).toHaveBeenCalledWith(20, { needPlayers: false });
      expect(result.success).toBe(true);
    });

    it("rechaza un groupSize mayor a los lugares libres", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5, groupSize: 3 });

      expect(result).toEqual({
        success: false,
        error: "Elegí entre 1 y 2 jugadores (los lugares libres que quedan).",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza un groupSize menor a 1", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5, groupSize: 0 });

      expect(result).toEqual({
        success: false,
        error: "Elegí entre 1 y 3 jugadores (los lugares libres que quedan).",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("toma un lock por partido antes de buscarlo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({ id: 20, needPlayers: true, matchPlayers: [] });

      await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(queryFn).toHaveBeenCalledWith(
        expect.stringContaining("pg_advisory_xact_lock"),
        expect.arrayContaining([10]),
      );
    });

    it("si al sumarse se completa el cupo máximo, el partido deja de necesitar jugadores", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        matchPlayers: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(update).toHaveBeenCalledWith(20, { needPlayers: false });
      expect(save).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it("respeta playersCount de cada jugador al calcular el cupo restante", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
        // El creador reservó con playersCount 4 (trajo acompañantes): ya no queda lugar.
        matchPlayers: [{ playerId: 1, playersCount: 4 }],
      });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({
        success: false,
        error: "El partido ya está completo, no quedan lugares libres.",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza al jugador si se encuentra bloqueado", async () => {
      playerFindOne.mockResolvedValueOnce({ id: 5, isBlocked: true });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({
        success: false,
        error: "El usuario se encuentra bloqueado y no puede realizar reservas.",
      });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el turno no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await joinOpenMatch({ bookingId: 999, playerId: 5 });

      expect(result).toEqual({ success: false, error: "El turno no existe." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el turno no tiene un partido abierto asociado", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce(null);

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Este turno no es un partido abierto." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el partido ya no está buscando jugadores", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({ id: 20, needPlayers: false, matchPlayers: [{ playerId: 1 }] });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Este turno no es un partido abierto." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el jugador ya está anotado en el partido", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({ id: 20, needPlayers: true, matchPlayers: [{ playerId: 5 }] });

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "Ya estás anotado en este partido." });
      expect(create).not.toHaveBeenCalled();
    });

    it("rechaza si el partido ya está completo", async () => {
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({
        id: 20,
        needPlayers: true,
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
      findOne.mockResolvedValueOnce({ id: 10, bookingState: BookingState.RESERVED });
      findOne.mockResolvedValueOnce({ id: 20, needPlayers: true, matchPlayers: [] });
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await joinOpenMatch({ bookingId: 10, playerId: 5 });

      expect(result).toEqual({ success: false, error: "No se pudo sumar al partido." });
    });
  });

  describe("getBookings", () => {
    it("devuelve todas las reservas con jugador, cancha y partido asociado", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getBookings();

      expect(find).toHaveBeenCalledWith({
        relations: { player: true, court: true, match: { matchPlayers: { player: true }, chat: true } },
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
        relations: { player: true, court: true, match: { matchPlayers: { player: true }, chat: true } },
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
