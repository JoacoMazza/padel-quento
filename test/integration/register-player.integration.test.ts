import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { redirect } from "next/navigation";
import { registerPlayer, type RegisterState } from "@/src/actions/register";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";

function buildFormData(overrides: Partial<Record<"names" | "lastnames" | "email" | "password", string>> = {}) {
  const formData = new FormData();
  formData.set("names", overrides.names ?? "Ana");
  formData.set("lastnames", overrides.lastnames ?? "Gomez");
  formData.set(
    "email",
    overrides.email ?? `jugador.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`,
  );
  formData.set("password", overrides.password ?? "secreto123");
  return formData;
}

const initialState: RegisterState = {};

describe("registerPlayer (integración con Postgres real)", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea un jugador nuevo con el hash de contraseña y los valores por defecto", async () => {
    const email = `nuevo.${Date.now()}@test.com`;
    const result = await registerPlayer(initialState, buildFormData({ email, password: "secreto123" }));

    // redirect() está mockeado como no-op (en producción interrumpe la ejecución lanzando),
    // así que el código continúa y la función retorna undefined implícitamente.
    expect(result).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/login");

    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const saved = await players.findOne({ where: { email } });

    expect(saved).not.toBeNull();
    expect(saved?.role).toBe("player");
    expect(saved?.category).toBe("without_category");
    expect(saved?.scoring).toBe(0);
    expect(saved?.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", saved!.passwordHash)).resolves.toBe(true);
  });

  it("no toca la base de datos y devuelve errores cuando el formulario es inválido", async () => {
    const result = await registerPlayer(
      initialState,
      buildFormData({ email: "no-es-un-email", password: "123" }),
    );

    expect(result.errors?.email).toBeDefined();
    expect(result.errors?.password).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("devuelve un mensaje de email duplicado y no crea una segunda fila", async () => {
    const email = `duplicado.${Date.now()}@test.com`;
    await registerPlayer(initialState, buildFormData({ email }));
    vi.mocked(redirect).mockClear();

    const result = await registerPlayer(initialState, buildFormData({ email }));

    expect(result.message).toMatch(/ya está en uso/i);
    expect(redirect).not.toHaveBeenCalled();

    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const count = await players.count({ where: { email } });
    expect(count).toBe(1);
  });
});
