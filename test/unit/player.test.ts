import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { PlayerCategory, Role } from "@/src/domain/enums";

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(async () => "hashed-password") },
}));

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

import bcrypt from "bcrypt";
import {
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} from "@/src/actions/player";

function duplicateError() {
  return new QueryFailedError("insert into users...", [], { code: "23505" } as never);
}

describe("player actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  describe("createPlayer", () => {
    it("crea un jugador con el hash de contraseña y los valores por defecto", async () => {
      const result = await createPlayer({
        email: "ana@test.com",
        password: "secreto123",
        names: "Ana",
        lastnames: "Gomez",
      });

      expect(bcrypt.hash).toHaveBeenCalledWith("secreto123", 12);
      expect(create).toHaveBeenCalledWith({
        email: "ana@test.com",
        passwordHash: "hashed-password",
        names: "Ana",
        lastnames: "Gomez",
        dni: null,
        phoneNumber: null,
        photoUrl: null,
        role: Role.PLAYER,
        category: PlayerCategory.WITHOUT_CATEGORY,
        scoring: 0,
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ email: "ana@test.com", role: Role.PLAYER }),
      });
    });

    it("respeta la categoría indicada", async () => {
      await createPlayer({
        email: "ana@test.com",
        password: "secreto123",
        names: "Ana",
        lastnames: "Gomez",
        category: PlayerCategory.THIRD,
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ category: PlayerCategory.THIRD }),
      );
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      save.mockRejectedValueOnce(duplicateError());

      const result = await createPlayer({
        email: "ana@test.com",
        password: "secreto123",
        names: "Ana",
        lastnames: "Gomez",
      });

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createPlayer({
        email: "ana@test.com",
        password: "secreto123",
        names: "Ana",
        lastnames: "Gomez",
      });

      expect(result).toEqual({ success: false, error: "No se pudo crear el jugador." });
    });
  });

  describe("getPlayers", () => {
    it("devuelve todos los jugadores", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getPlayers();

      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getPlayers();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener los jugadores." });
    });
  });

  describe("getPlayerById", () => {
    it("devuelve el jugador encontrado", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getPlayerById(1);

      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getPlayerById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updatePlayer", () => {
    it("actualiza los campos provistos sin tocar la contraseña", async () => {
      findOne.mockResolvedValueOnce({ id: 1, names: "Ana", passwordHash: "old-hash" });

      const result = await updatePlayer(1, { names: "Ana María" });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: { id: 1, names: "Ana María", passwordHash: "old-hash" },
      });
    });

    it("rehashea la contraseña cuando se provee una nueva", async () => {
      findOne.mockResolvedValueOnce({ id: 1, passwordHash: "old-hash" });

      const result = await updatePlayer(1, { password: "nuevaClave123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("nuevaClave123", 12);
      expect(result).toEqual({
        success: true,
        data: { id: 1, passwordHash: "hashed-password" },
      });
    });

    it("devuelve error si el jugador no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updatePlayer(999, { names: "Nadie" });

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });
      save.mockRejectedValueOnce(duplicateError());

      const result = await updatePlayer(1, { email: "existente@test.com" });

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });
  });

  describe("deletePlayer", () => {
    it("elimina el jugador", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deletePlayer(1);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el jugador no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deletePlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
    });
  });
});
