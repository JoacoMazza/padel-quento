import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { Role } from "@/src/domain/enums";

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
import { createUser, getUsers, getUserById, updateUser, deleteUser } from "@/src/actions/user";

function duplicateError() {
  return new QueryFailedError("insert into users...", [], { code: "23505" } as never);
}

describe("user actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  describe("createUser", () => {
    it("crea un usuario con el hash de contraseña y rol ADMIN por defecto", async () => {
      const result = await createUser({
        email: "admin@test.com",
        password: "secreto123",
        names: "Admin",
        lastnames: "Uno",
      });

      expect(bcrypt.hash).toHaveBeenCalledWith("secreto123", 12);
      expect(create).toHaveBeenCalledWith({
        email: "admin@test.com",
        passwordHash: "hashed-password",
        names: "Admin",
        lastnames: "Uno",
        dni: null,
        phoneNumber: null,
        photoUrl: null,
        role: Role.ADMIN,
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ email: "admin@test.com", role: Role.ADMIN }),
      });
    });

    it("respeta el rol indicado", async () => {
      await createUser({
        email: "jugador@test.com",
        password: "secreto123",
        names: "J",
        lastnames: "Ugador",
        role: Role.PLAYER,
      });

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ role: Role.PLAYER }));
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      save.mockRejectedValueOnce(duplicateError());

      const result = await createUser({
        email: "admin@test.com",
        password: "secreto123",
        names: "Admin",
        lastnames: "Uno",
      });

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createUser({
        email: "admin@test.com",
        password: "secreto123",
        names: "Admin",
        lastnames: "Uno",
      });

      expect(result).toEqual({ success: false, error: "No se pudo crear el usuario." });
    });
  });

  describe("getUsers", () => {
    it("devuelve todos los usuarios", async () => {
      find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getUsers();

      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getUsers();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener los usuarios." });
    });
  });

  describe("getUserById", () => {
    it("devuelve el usuario encontrado", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getUserById(1);

      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getUserById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updateUser", () => {
    it("actualiza los campos provistos sin tocar la contraseña", async () => {
      findOne.mockResolvedValueOnce({ id: 1, names: "Admin", passwordHash: "old-hash" });

      const result = await updateUser(1, { names: "Administrador" });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: { id: 1, names: "Administrador", passwordHash: "old-hash" },
      });
    });

    it("rehashea la contraseña cuando se provee una nueva", async () => {
      findOne.mockResolvedValueOnce({ id: 1, passwordHash: "old-hash" });

      const result = await updateUser(1, { password: "nuevaClave123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("nuevaClave123", 12);
      expect(result).toEqual({ success: true, data: { id: 1, passwordHash: "hashed-password" } });
    });

    it("devuelve error si el usuario no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updateUser(999, { names: "Nadie" });

      expect(result).toEqual({ success: false, error: "El usuario no existe." });
      expect(save).not.toHaveBeenCalled();
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });
      save.mockRejectedValueOnce(duplicateError());

      const result = await updateUser(1, { email: "existente@test.com" });

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });
  });

  describe("deleteUser", () => {
    it("elimina el usuario", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deleteUser(1);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el usuario no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deleteUser(999);

      expect(result).toEqual({ success: false, error: "El usuario no existe." });
    });
  });
});
