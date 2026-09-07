import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { CourtState } from "@/src/domain/enums";

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
  createCourt,
  getCourts,
  getCourtById,
  updateCourt,
  deleteCourt,
} from "@/src/actions/court";

function duplicateError() {
  return new QueryFailedError("insert into courts...", [], { code: "23505" } as never);
}

describe("court actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
  });

  describe("createCourt", () => {
    it("crea una cancha con el estado AVAILABLE por defecto", async () => {
      const result = await createCourt({ number: 3 });

      expect(create).toHaveBeenCalledWith({ number: 3, state: CourtState.AVAILABLE });
      expect(result).toEqual({ success: true, data: { number: 3, state: CourtState.AVAILABLE } });
    });

    it("respeta el estado indicado", async () => {
      await createCourt({ number: 5, state: CourtState.MAINTENANCE });

      expect(create).toHaveBeenCalledWith({ number: 5, state: CourtState.MAINTENANCE });
    });

    it("devuelve error de número duplicado ante una violación de unicidad", async () => {
      save.mockRejectedValueOnce(duplicateError());

      const result = await createCourt({ number: 1 });

      expect(result).toEqual({ success: false, error: "Ya existe una cancha con ese número." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createCourt({ number: 1 });

      expect(result).toEqual({ success: false, error: "No se pudo crear la cancha." });
    });
  });

  describe("getCourts", () => {
    it("devuelve todas las canchas", async () => {
      find.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await getCourts();

      expect(result).toEqual({ success: true, data: [{ id: 1 }, { id: 2 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getCourts();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener las canchas." });
    });
  });

  describe("getCourtById", () => {
    it("devuelve la cancha encontrada", async () => {
      findOne.mockResolvedValueOnce({ id: 1, number: 3 });

      const result = await getCourtById(1);

      expect(findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ success: true, data: { id: 1, number: 3 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getCourtById(999);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve un error si falla la consulta", async () => {
      findOne.mockRejectedValueOnce(new Error("db down"));

      const result = await getCourtById(1);

      expect(result).toEqual({ success: false, error: "No se pudo obtener la cancha." });
    });
  });

  describe("updateCourt", () => {
    it("actualiza los campos provistos", async () => {
      findOne.mockResolvedValueOnce({ id: 1, number: 3, state: CourtState.AVAILABLE });

      const result = await updateCourt(1, { state: CourtState.MAINTENANCE });

      expect(result).toEqual({
        success: true,
        data: { id: 1, number: 3, state: CourtState.MAINTENANCE },
      });
    });

    it("devuelve error si la cancha no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updateCourt(999, { number: 1 });

      expect(result).toEqual({ success: false, error: "La cancha no existe." });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve error de número duplicado ante una violación de unicidad", async () => {
      findOne.mockResolvedValueOnce({ id: 1, number: 3 });
      save.mockRejectedValueOnce(duplicateError());

      const result = await updateCourt(1, { number: 7 });

      expect(result).toEqual({ success: false, error: "Ya existe una cancha con ese número." });
    });
  });

  describe("deleteCourt", () => {
    it("elimina la cancha", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deleteCourt(1);

      expect(deleteFn).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si la cancha no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deleteCourt(999);

      expect(result).toEqual({ success: false, error: "La cancha no existe." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      deleteFn.mockRejectedValueOnce(new Error("boom"));

      const result = await deleteCourt(1);

      expect(result).toEqual({ success: false, error: "No se pudo eliminar la cancha." });
    });
  });
});
