import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState } from "@/src/domain/enums";

const { create, save, find, findOne, merge, deleteFn, getDataSource } = vi.hoisted(() => {
  const create = vi.fn((data: unknown) => data);
  const save = vi.fn(async (entity: unknown) => entity);
  const find = vi.fn();
  const findOne = vi.fn();
  const merge = vi.fn((entity: any, dto: any) => Object.assign(entity, dto));
  const deleteFn = vi.fn();
  const getRepository = vi.fn(() => ({ create, save, find, findOne, merge, delete: deleteFn }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { create, save, find, findOne, merge, deleteFn, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} from "@/src/actions/booking";

const fromDateTime = new Date("2026-01-01T10:00:00Z");

describe("booking actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
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

    it("devuelve un error genérico si falla el guardado", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createBooking({ fromDateTime, playerId: 1, courtId: 2 });

      expect(result).toEqual({ success: false, error: "No se pudo crear la reserva." });
    });
  });

  describe("getBookings", () => {
    it("devuelve todas las reservas con jugador y cancha", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getBookings();

      expect(find).toHaveBeenCalledWith({ relations: { player: true, court: true } });
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
        relations: { player: true, court: true },
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

    it("reasigna jugador y cancha cuando se proveen", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await updateBooking(1, { playerId: 3, courtId: 4 });

      expect(result).toEqual({ success: true, data: { id: 1, player: { id: 3 }, court: { id: 4 } } });
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
