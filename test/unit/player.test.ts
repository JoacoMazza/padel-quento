import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { PlayerCategory } from "@/src/domain/enums";

vi.mock("bcrypt", () => ({
  default: { hash: vi.fn(async () => "hashed-password") },
}));

const { repos, getDataSource } = vi.hoisted(() => {
  const makeRepo = () => ({
    create: vi.fn((data: unknown) => data),
    save: vi.fn(async (entity: object) => ({ id: 1, ...entity })),
    find: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(async () => ({ affected: 1 })),
    delete: vi.fn(async () => ({ affected: 1 })),
  });
  const repos = { Account: makeRepo(), Player: makeRepo() };
  const getRepository = vi.fn((entity: keyof typeof repos) => repos[entity]);
  const manager = { getRepository };
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));
  return { repos, getDataSource };
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

function uniqueViolation(constraint: string) {
  return new QueryFailedError("insert into ...", [], { code: "23505", constraint } as never);
}

const input = {
  email: "ana@test.com",
  password: "secreto123",
  names: "Ana",
  lastnames: "Gomez",
  phoneNumber: "2215550101",
};

function storedPlayer() {
  return {
    id: 1,
    names: "Ana",
    lastnames: "Gomez",
    phoneNumber: "2215550101",
    category: PlayerCategory.WITHOUT_CATEGORY,
    scoring: 0,
    account: { id: 10, email: "ana@test.com", passwordHash: "old-hash", photoUrl: null, isBlocked: false },
  };
}

describe("player actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const repo of Object.values(repos)) {
      repo.create.mockImplementation((data: unknown) => data);
      repo.save.mockImplementation(async (entity: object) => ({ id: 1, ...entity }));
    }
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
  });

  describe("createPlayer", () => {
    it("crea la cuenta y el jugador (que es un booker) con el hash de contraseña y los valores por defecto", async () => {
      const result = await createPlayer(input);

      expect(bcrypt.hash).toHaveBeenCalledWith("secreto123", 12);
      expect(repos.Account.create).toHaveBeenCalledWith({
        email: "ana@test.com",
        passwordHash: "hashed-password",
        photoUrl: null,
      });
      expect(repos.Player.create).toHaveBeenCalledWith({
        account: expect.objectContaining({ email: "ana@test.com" }),
        names: "Ana",
        lastnames: "Gomez",
        phoneNumber: "2215550101",
        category: PlayerCategory.WITHOUT_CATEGORY,
        scoring: 0,
      });
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          names: "Ana",
          account: expect.objectContaining({ email: "ana@test.com" }),
        }),
      });
    });

    it("respeta la categoría indicada", async () => {
      await createPlayer({ ...input, category: PlayerCategory.THIRD });

      expect(repos.Player.create).toHaveBeenCalledWith(
        expect.objectContaining({ category: PlayerCategory.THIRD }),
      );
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad del email", async () => {
      repos.Account.save.mockRejectedValueOnce(uniqueViolation("UQ_accounts_email"));

      const result = await createPlayer(input);

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });

    it("devuelve un mensaje de teléfono duplicado ante una violación de unicidad del teléfono", async () => {
      repos.Player.save.mockRejectedValueOnce(uniqueViolation("UQ_bookers_phone_number"));

      const result = await createPlayer(input);

      expect(result).toEqual({ success: false, error: "El teléfono ya está en uso." });
    });

    it("devuelve un error genérico ante cualquier otra falla", async () => {
      repos.Player.save.mockRejectedValueOnce(new Error("boom"));

      const result = await createPlayer(input);

      expect(result).toEqual({ success: false, error: "No se pudo crear el jugador." });
    });
  });

  describe("getPlayers", () => {
    it("devuelve todos los jugadores con su cuenta", async () => {
      repos.Player.find.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getPlayers();

      expect(repos.Player.find).toHaveBeenCalledWith({ relations: { account: true } });
      expect(result).toEqual({ success: true, data: [{ id: 1 }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      repos.Player.find.mockRejectedValueOnce(new Error("db down"));

      const result = await getPlayers();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener los jugadores." });
    });
  });

  describe("getPlayerById", () => {
    it("devuelve el jugador encontrado", async () => {
      repos.Player.findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getPlayerById(1);

      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      repos.Player.findOne.mockResolvedValueOnce(null);

      const result = await getPlayerById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updatePlayer", () => {
    it("actualiza nombre y categoría del jugador sin tocar la contraseña", async () => {
      repos.Player.findOne.mockResolvedValueOnce(storedPlayer());

      const result = await updatePlayer(1, { names: "Ana María", category: PlayerCategory.FIFTH });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(repos.Player.save).toHaveBeenCalledWith(expect.objectContaining({ names: "Ana María" }));
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          category: PlayerCategory.FIFTH,
          names: "Ana María",
          account: expect.objectContaining({ passwordHash: "old-hash" }),
        }),
      });
    });

    it("rehashea la contraseña de la cuenta cuando se provee una nueva", async () => {
      repos.Player.findOne.mockResolvedValueOnce(storedPlayer());

      const result = await updatePlayer(1, { password: "nuevaClave123" });

      expect(bcrypt.hash).toHaveBeenCalledWith("nuevaClave123", 12);
      expect(repos.Account.save).toHaveBeenCalledWith(expect.objectContaining({ passwordHash: "hashed-password" }));
      expect(result.success).toBe(true);
    });

    it("devuelve error si el jugador no existe", async () => {
      repos.Player.findOne.mockResolvedValueOnce(null);

      const result = await updatePlayer(999, { names: "Nadie" });

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(repos.Player.save).not.toHaveBeenCalled();
    });

    it("devuelve un mensaje de correo duplicado ante una violación de unicidad", async () => {
      repos.Player.findOne.mockResolvedValueOnce(storedPlayer());
      repos.Account.save.mockRejectedValueOnce(uniqueViolation("UQ_accounts_email"));

      const result = await updatePlayer(1, { email: "existente@test.com" });

      expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
    });
  });

  describe("deletePlayer", () => {
    it("elimina la cuenta del jugador (el jugador se borra en cascada)", async () => {
      repos.Player.findOne.mockResolvedValueOnce(storedPlayer());

      const result = await deletePlayer(1);

      expect(repos.Account.delete).toHaveBeenCalledWith(10);
      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el jugador no existe", async () => {
      repos.Player.findOne.mockResolvedValueOnce(null);

      const result = await deletePlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(repos.Account.delete).not.toHaveBeenCalled();
    });
  });
});
