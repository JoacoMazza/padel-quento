import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(async () => "hashed-password") },
}));

const { repos, getDataSource } = vi.hoisted(() => {
  const makeRepo = () => ({
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (entity: object) => ({ id: 1, ...entity })),
    find: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(async () => ({ affected: 1 })),
  });
  const repos = { Account: makeRepo(), Admin: makeRepo() };
  const getRepository = vi.fn((entity: keyof typeof repos) => repos[entity]);
  const manager = { getRepository };
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));
  return { repos, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import bcrypt from "bcrypt";
import { createAdmin, getAdmins, getAdminById, updateAdmin, deleteAdmin } from "@/src/actions/admin";

function duplicateError() {
  return new QueryFailedError("insert into accounts...", [], { code: "23505", constraint: "UQ_accounts_email" } as never);
}

const input = { email: "admin@test.com", password: "secreto123", names: "Admin", lastnames: "Uno" };

function storedAdmin() {
  return {
    id: 1,
    names: "Admin",
    lastnames: "Uno",
    dni: null,
    account: { id: 10, email: "admin@test.com", passwordHash: "old-hash", photoUrl: null, isBlocked: false },
  };
}

describe("admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const repo of Object.values(repos)) {
      repo.create.mockImplementation((data: unknown) => data);
      repo.save.mockImplementation(async (entity: object) => ({ id: 1, ...entity }));
    }
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  describe("createAdmin", () => {
    it("crea la cuenta y el administrador con el hash de contraseña", async () => {
      const result = await createAdmin({ ...input, dni: 30111222 });

      expect(bcrypt.hash).toHaveBeenCalledWith("secreto123", 12);
      expect(repos.Account.create).toHaveBeenCalledWith({
        email: "admin@test.com",
        passwordHash: "hashed-password",
        photoUrl: null,
      });
      expect(repos.Admin.create).toHaveBeenCalledWith({
        account: expect.objectContaining({ email: "admin@test.com" }),
        names: "Admin",
        lastnames: "Uno",
        dni: 30111222,
      });
      expect(result).toEqual({ success: true, data: expect.objectContaining({ names: "Admin" }) });
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      repos.Account.save.mockRejectedValueOnce(duplicateError());

      const result = await createAdmin(input);

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      repos.Admin.save.mockRejectedValueOnce(new Error("boom"));

      const result = await createAdmin(input);

      expect(result).toEqual({ success: false, error: "No se pudo crear el administrador." });
    });
  });

  describe("getAdmins / getAdminById", () => {
    it("devuelve los administradores con su cuenta", async () => {
      repos.Admin.find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getAdmins();

      expect(repos.Admin.find).toHaveBeenCalledWith({ relations: { account: true } });
      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve data null cuando el administrador no existe", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(null);

      const result = await getAdminById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updateAdmin", () => {
    it("actualiza los datos del administrador y rehashea la contraseña de la cuenta", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(storedAdmin());

      const result = await updateAdmin(1, { names: "Administrador", password: "nuevaClave123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("nuevaClave123", 12);
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          names: "Administrador",
          account: expect.objectContaining({ passwordHash: "hashed-password" }),
        }),
      });
    });

    it("devuelve error si el administrador no existe", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(null);

      const result = await updateAdmin(999, { names: "Nadie" });

      expect(result).toEqual({ success: false, error: "El administrador no existe." });
    });
  });

  describe("deleteAdmin", () => {
    it("elimina la cuenta del administrador", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(storedAdmin());

      const result = await deleteAdmin(1);

      expect(repos.Account.delete).toHaveBeenCalledWith(10);
      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el administrador no existe", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(null);

      const result = await deleteAdmin(999);

      expect(result).toEqual({ success: false, error: "El administrador no existe." });
    });
  });
});
