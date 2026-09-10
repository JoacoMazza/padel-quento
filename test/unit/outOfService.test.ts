import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, OutOfServiceReason } from "@/src/domain/enums";

const {
  create,
  save,
  find,
  findOne,
  merge,
  deleteFn,
  updateFn,
  getMany,
  getDataSource,
} = vi.hoisted(() => {
  const create = vi.fn((data: unknown) => data);
  const save = vi.fn(async (entity: unknown) => entity);
  const find = vi.fn();
  const findOne = vi.fn();
  const merge = vi.fn((entity: any, dto: any) => Object.assign(entity, dto));
  const deleteFn = vi.fn();
  const updateFn = vi.fn(async () => ({ affected: 0 }));
  const getMany = vi.fn(async () => [] as unknown[]);

  const repository = { create, save, find, findOne, merge, delete: deleteFn, update: updateFn };

  const queryBuilder: any = {};
  queryBuilder.where = vi.fn(() => queryBuilder);
  queryBuilder.andWhere = vi.fn(() => queryBuilder);
  queryBuilder.getMany = getMany;

  const manager = {
    getRepository: vi.fn(() => repository),
    createQueryBuilder: vi.fn(() => queryBuilder),
  };

  const getRepository = vi.fn(() => repository);
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));

  return { create, save, find, findOne, merge, deleteFn, updateFn, getMany, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import {
  createOutOfService,
  getOutOfServices,
  getOutOfServiceById,
  updateOutOfService,
  deleteOutOfService,
} from "@/src/actions/outOfService";

const fromDateTime = new Date("2026-01-01T09:00:00Z");
const toDateTime = new Date("2026-01-01T12:00:00Z");

describe("outOfService actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
    getMany.mockResolvedValue([]);
  });

  describe("createOutOfService", () => {
    it("crea un bloqueo asociado a la cancha indicada", async () => {
      const result = await createOutOfService({
        fromDateTime,
        toDateTime,
        reason: OutOfServiceReason.MAINTENANCE,
        courtId: 1,
      });

      expect(create).toHaveBeenCalledWith({
        fromDateTime,
        toDateTime,
        reason: OutOfServiceReason.MAINTENANCE,
        description: null,
        court: { id: 1 },
      });
      expect(result).toEqual({
        success: true,
        data: {
          outOfService: {
            fromDateTime,
            toDateTime,
            reason: OutOfServiceReason.MAINTENANCE,
            description: null,
            court: { id: 1 },
          },
          cancelledBookings: [],
        },
      });
    });

    it("conserva la descripción cuando se provee", async () => {
      await createOutOfService({
        fromDateTime,
        toDateTime,
        reason: OutOfServiceReason.CLEANING,
        description: "Limpieza profunda",
        courtId: 1,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Limpieza profunda" }),
      );
    });

    it("cancela sin penalizar las reservas superpuestas con el bloqueo", async () => {
      const overlapping = [
        { id: 10, bookingState: BookingState.RESERVED },
        { id: 11, bookingState: BookingState.PAID },
      ];
      getMany.mockResolvedValueOnce(overlapping);

      const result = await createOutOfService({
        fromDateTime,
        toDateTime,
        reason: OutOfServiceReason.MAINTENANCE,
        courtId: 1,
      });

      expect(updateFn).toHaveBeenCalledWith(
        { id: expect.anything() },
        { bookingState: BookingState.CANCELLED },
      );
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          cancelledBookings: [
            { id: 10, bookingState: BookingState.CANCELLED },
            { id: 11, bookingState: BookingState.CANCELLED },
          ],
        }),
      });
    });

    it("devuelve un error genérico si falla el guardado", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createOutOfService({
        fromDateTime,
        toDateTime,
        reason: OutOfServiceReason.OTHER,
        courtId: 1,
      });

      expect(result).toEqual({
        success: false,
        error: "No se pudo crear el bloqueo de cancha.",
      });
    });
  });

  describe("getOutOfServices", () => {
    it("devuelve todos los bloqueos con su cancha", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getOutOfServices();

      expect(find).toHaveBeenCalledWith({ relations: { court: true } });
      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getOutOfServices();

      expect(result).toEqual({
        success: false,
        error: "No se pudieron obtener los bloqueos de cancha.",
      });
    });
  });

  describe("getOutOfServiceById", () => {
    it("devuelve el bloqueo encontrado", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getOutOfServiceById(1);

      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getOutOfServiceById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updateOutOfService", () => {
    it("actualiza los campos escalares provistos", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        reason: OutOfServiceReason.MAINTENANCE,
        fromDateTime,
        toDateTime,
        court: { id: 1 },
      });

      const result = await updateOutOfService(1, { reason: OutOfServiceReason.OTHER });

      expect(result).toEqual({
        success: true,
        data: {
          outOfService: {
            id: 1,
            reason: OutOfServiceReason.OTHER,
            fromDateTime,
            toDateTime,
            court: { id: 1 },
          },
          cancelledBookings: [],
        },
      });
    });

    it("reasigna la cancha cuando se provee courtId", async () => {
      findOne.mockResolvedValueOnce({ id: 1, fromDateTime, toDateTime, court: { id: 1 } });

      const result = await updateOutOfService(1, { courtId: 2 });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          outOfService: expect.objectContaining({ id: 1, court: { id: 2 } }),
        }),
      });
    });

    it("cancela sin penalizar las reservas que quedan dentro del nuevo rango", async () => {
      findOne.mockResolvedValueOnce({ id: 1, fromDateTime, toDateTime, court: { id: 1 } });
      getMany.mockResolvedValueOnce([{ id: 20, bookingState: BookingState.RESERVED }]);

      const result = await updateOutOfService(1, { toDateTime: new Date("2026-01-01T15:00:00Z") });

      expect(updateFn).toHaveBeenCalledWith(
        { id: expect.anything() },
        { bookingState: BookingState.CANCELLED },
      );
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          cancelledBookings: [{ id: 20, bookingState: BookingState.CANCELLED }],
        }),
      });
    });

    it("devuelve error si el bloqueo no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updateOutOfService(999, { reason: OutOfServiceReason.OTHER });

      expect(result).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("deleteOutOfService", () => {
    it("elimina el bloqueo", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deleteOutOfService(1);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el bloqueo no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deleteOutOfService(999);

      expect(result).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
    });
  });
});
