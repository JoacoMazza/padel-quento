import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { AdminAccessLevel } from "@/src/domain/enums";

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
// La sesión es la del dueño (id 99); el chequeo real contra la base se prueba en integración.
vi.mock("@/src/lib/rbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/rbac")>();
  return { ...actual, requireOwner: vi.fn(async () => ({ email: "owner@test.com", adminId: 99 })) };
});

import bcrypt from "bcrypt";
import { createAdmin, getAdmins, getAdminById, updateAdmin, deleteAdmin } from "@/src/actions/admin";

function duplicateError(constraint = "UQ_accounts_email") {
  return new QueryFailedError("insert into accounts...", [], { code: "23505", constraint } as never);
}

const input = { email: "admin@test.com", password: "secreto123", names: "Admin", lastnames: "Uno", dni: 30111222 };

function storedAdmin() {
  return {
    id: 1,
    names: "Admin",
    lastnames: "Uno",
    dni: null,
    account: { id: 10, email: "admin@test.com", passwordHash: "old-hash", isBlocked: false },
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
      const result = await createAdmin(input);

      expect(bcrypt.hash).toHaveBeenCalledWith("secreto123", 12);
      expect(repos.Account.create).toHaveBeenCalledWith({
        email: "admin@test.com",
        passwordHash: "hashed-password",
      });
      expect(repos.Admin.create).toHaveBeenCalledWith({
        account: expect.objectContaining({ email: "admin@test.com" }),
        names: "Admin",
        lastnames: "Uno",
        dni: 30111222,
        accessLevel: AdminAccessLevel.STAFF,
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

    it("exige el DNI", async () => {
      const result = await createAdmin({ ...input, dni: null as unknown as number });

      expect(result).toEqual({ success: false, error: "El DNI es obligatorio." });
      expect(repos.Account.save).not.toHaveBeenCalled();
    });

    it.each([123456, 123456789, 30111222.5, -30111222])("rechaza el DNI inválido %s", async (dni) => {
      const result = await createAdmin({ ...input, dni });

      expect(result).toEqual({ success: false, error: "Ingresá un DNI válido (7 u 8 dígitos)." });
      expect(repos.Account.save).not.toHaveBeenCalled();
    });

    it("acepta DNI de 7 dígitos", async () => {
      const result = await createAdmin({ ...input, dni: 9876543 });

      expect(result.success).toBe(true);
    });

    it("devuelve un mensaje de DNI repetido si ya hay un administrador con ese DNI", async () => {
      repos.Admin.save.mockRejectedValueOnce(duplicateError("UQ_admins_dni"));

      const result = await createAdmin(input);

      expect(result).toEqual({ success: false, error: "Ya hay un administrador con ese DNI." });
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
      repos.Admin.findOne.mockResolvedValueOnce({ ...storedAdmin(), dni: 30111222 });

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

    it("no permite borrar el DNI", async () => {
      repos.Admin.findOne.mockResolvedValueOnce({ ...storedAdmin(), dni: 30111222 });

      const result = await updateAdmin(1, { dni: null as unknown as number });

      expect(result).toEqual({ success: false, error: "El DNI es obligatorio." });
      expect(repos.Admin.save).not.toHaveBeenCalled();
    });

    it("rechaza un DNI inválido", async () => {
      repos.Admin.findOne.mockResolvedValueOnce({ ...storedAdmin(), dni: 30111222 });

      const result = await updateAdmin(1, { dni: 12 });

      expect(result).toEqual({ success: false, error: "Ingresá un DNI válido (7 u 8 dígitos)." });
      expect(repos.Admin.save).not.toHaveBeenCalled();
    });

    it("a un administrador sin DNI (anterior a que fuera obligatorio) le pide cargarlo al editarlo", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(storedAdmin());

      const result = await updateAdmin(1, { names: "Administrador" });

      expect(result).toEqual({ success: false, error: "El DNI es obligatorio." });
      expect(repos.Admin.save).not.toHaveBeenCalled();
    });

    it("a un administrador sin DNI le permite cargarlo", async () => {
      repos.Admin.findOne.mockResolvedValueOnce(storedAdmin());

      const result = await updateAdmin(1, { dni: 30111222 });

      expect(result).toEqual({ success: true, data: expect.objectContaining({ dni: 30111222 }) });
    });

    it("devuelve un mensaje de DNI repetido si otro administrador ya lo tiene", async () => {
      repos.Admin.findOne.mockResolvedValueOnce({ ...storedAdmin(), dni: 30111222 });
      repos.Admin.save.mockRejectedValueOnce(duplicateError("UQ_admins_dni"));

      const result = await updateAdmin(1, { dni: 30111223 });

      expect(result).toEqual({ success: false, error: "Ya hay un administrador con ese DNI." });
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
