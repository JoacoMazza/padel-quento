import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutOfServiceReason } from "@/src/domain/enums";

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
          fromDateTime,
          toDateTime,
          reason: OutOfServiceReason.MAINTENANCE,
          description: null,
          court: { id: 1 },
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
      findOne.mockResolvedValueOnce({ id: 1, reason: OutOfServiceReason.MAINTENANCE });

      const result = await updateOutOfService(1, { reason: OutOfServiceReason.OTHER });

      expect(result).toEqual({
        success: true,
        data: { id: 1, reason: OutOfServiceReason.OTHER },
      });
    });

    it("reasigna la cancha cuando se provee courtId", async () => {
      findOne.mockResolvedValueOnce({ id: 1, court: { id: 1 } });

      const result = await updateOutOfService(1, { courtId: 2 });

      expect(result).toEqual({ success: true, data: { id: 1, court: { id: 2 } } });
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
