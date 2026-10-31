import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn() },
}));

const { findOne, getDataSource } = vi.hoisted(() => {
  const findOne = vi.fn();
  const getRepository = vi.fn(() => ({ findOne }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { findOne, getRepository, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { authOptions } from "@/src/lib/auth";

type Credentials = { email?: string; password?: string } | undefined;

function getAuthorize() {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: Credentials) => Promise<unknown> };
  };
  return provider.options.authorize;
}

describe("authorize (CredentialsProvider)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve null cuando falta el email o la contraseña", async () => {
    const authorize = getAuthorize();

    expect(await authorize({ email: "", password: "x" })).toBeNull();
    expect(await authorize({ email: "a@b.com", password: "" })).toBeNull();
    expect(await authorize(undefined)).toBeNull();
    expect(getDataSource).not.toHaveBeenCalled();
  });

  it("devuelve null cuando no existe un usuario con ese email", async () => {
    findOne.mockResolvedValueOnce(null);

    const result = await getAuthorize()({ email: "nadie@test.com", password: "secreto" });

    expect(result).toBeNull();
  });

  it("devuelve null cuando la contraseña no coincide", async () => {
    findOne.mockResolvedValueOnce({
      id: 1,
      email: "a@test.com",
      passwordHash: "hash",
      names: "A",
      lastnames: "B",
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const result = await getAuthorize()({ email: "a@test.com", password: "mala" });

    expect(result).toBeNull();
  });

  it("devuelve los datos de la cuenta de un administrador con rol admin y normaliza el email en éxito", async () => {
    findOne.mockResolvedValueOnce({
      id: 7,
      email: "a@test.com",
      passwordHash: "hash",
      admin: { id: 1, names: "Ana", lastnames: "Gomez", accessLevel: "owner" },
      player: null,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await getAuthorize()({ email: "  A@Test.com ", password: "correcta" });

    expect(result).toEqual({
      id: "7",
      email: "a@test.com",
      name: "Ana Gomez",
      role: "admin",
      isOwner: true,
      isTeacher: false,
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { email: "a@test.com" },
      relations: { admin: true, player: { teacher: true } },
    });
  });

  it("deduce el rol player y toma el nombre del jugador para la cuenta de un jugador", async () => {
    findOne.mockResolvedValueOnce({
      id: 8,
      email: "j@test.com",
      passwordHash: "hash",
      admin: null,
      player: { id: 2, names: "Luis", lastnames: "Pérez" },
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await getAuthorize()({ email: "j@test.com", password: "correcta" });

    expect(result).toEqual({
      id: "8",
      email: "j@test.com",
      name: "Luis Pérez",
      role: "player",
      isOwner: false,
      isTeacher: false,
    });
  });

  it("indica si el jugador es un profesor activo (HU-42)", async () => {
    const teacherAccount = (isActive: boolean) => ({
      id: 9,
      email: "p@test.com",
      passwordHash: "hash",
      admin: null,
      player: { id: 3, names: "Lucía", lastnames: "Profe", teacher: { id: 1, isActive } },
    });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    findOne.mockResolvedValueOnce(teacherAccount(true));
    expect(await getAuthorize()({ email: "p@test.com", password: "correcta" })).toMatchObject({
      role: "player",
      isTeacher: true,
    });

    findOne.mockResolvedValueOnce(teacherAccount(false));
    expect(await getAuthorize()({ email: "p@test.com", password: "correcta" })).toMatchObject({
      role: "player",
      isTeacher: false,
    });
  });

  it("devuelve null cuando el usuario tiene isBlocked = true (aunque la contraseña sea correcta)", async () => {
    findOne.mockResolvedValueOnce({
      id: 2,
      email: "bloqueado@test.com",
      passwordHash: "hash",
      names: "Carlos",
      lastnames: "Sanchez",
      role: "player",
      isBlocked: true,
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await getAuthorize()({ email: "bloqueado@test.com", password: "correcta" });

    expect(result).toBeNull();
  });

  it("devuelve null en vez de lanzar cuando falla la conexión a la base de datos", async () => {
    getDataSource.mockRejectedValueOnce(new Error("connection refused"));

    const result = await getAuthorize()({ email: "a@test.com", password: "x" });

    expect(result).toBeNull();
  });

  describe("callbacks (jwt & session)", () => {
    it("propaga el rol del usuario en el token JWT", async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      if (!jwtCallback) throw new Error("jwt callback missing");

      const token = await jwtCallback({
        token: {},
        user: { id: "123", email: "admin@test.com", name: "Admin Test", role: "admin" as any },
      } as any);

      expect(token).toMatchObject({
        id: "123",
        sub: "123",
        email: "admin@test.com",
        name: "Admin Test",
        role: "admin",
      });
    });

    it("lleva isTeacher del login al token y a la sesión", async () => {
      const callbacks = authOptions.callbacks!;

      const token = await callbacks.jwt!({
        token: {},
        user: { id: "9", email: "p@test.com", name: "Lucía Profe", role: "player", isTeacher: true },
      } as never);
      const session = await callbacks.session!({ session: { user: {}, expires: "1" }, token } as never);

      expect(token).toMatchObject({ isTeacher: true });
      expect((session as { user: { isTeacher?: boolean } }).user.isTeacher).toBe(true);
    });

    it("propaga el rol del token en la sesión", async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) throw new Error("session callback missing");

      const session = await sessionCallback({
        session: { user: { email: "admin@test.com", name: "Admin" }, expires: "1" } as any,
        token: { id: "123", email: "admin@test.com", name: "Admin", role: "admin" as any },
      } as any);

      expect(session.user).toMatchObject({
        id: "123",
        email: "admin@test.com",
        name: "Admin",
        role: "admin",
      });
    });
  });
});
