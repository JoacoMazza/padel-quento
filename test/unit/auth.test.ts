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

  it("devuelve los datos del usuario y normaliza el email en éxito", async () => {
    findOne.mockResolvedValueOnce({
      id: 7,
      email: "a@test.com",
      passwordHash: "hash",
      names: "Ana",
      lastnames: "Gomez",
    });
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

    const result = await getAuthorize()({ email: "  A@Test.com ", password: "correcta" });

    expect(result).toEqual({ id: "7", email: "a@test.com", name: "Ana Gomez" });
    expect(findOne).toHaveBeenCalledWith({ where: { email: "a@test.com" } });
  });

  it("devuelve null en vez de lanzar cuando falla la conexión a la base de datos", async () => {
    getDataSource.mockRejectedValueOnce(new Error("connection refused"));

    const result = await getAuthorize()({ email: "a@test.com", password: "x" });

    expect(result).toBeNull();
  });
});
