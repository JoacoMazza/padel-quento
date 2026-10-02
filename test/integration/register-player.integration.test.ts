import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { redirect } from "next/navigation";
import { registerPlayer, type RegisterState } from "@/src/actions/register";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { uniquePhoneNumber } from "./helpers";

function buildFormData(
  overrides: Partial<Record<"names" | "lastnames" | "email" | "password" | "phoneNumber", string>> = {},
) {
  const formData = new FormData();
  formData.set("names", overrides.names ?? "Ana");
  formData.set("lastnames", overrides.lastnames ?? "Gomez");
  formData.set(
    "email",
    overrides.email ?? `jugador.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`,
  );
  formData.set("password", overrides.password ?? "secreto123");
  formData.set("phoneNumber", overrides.phoneNumber ?? uniquePhoneNumber());
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

  it("crea un jugador nuevo con su cuenta, el hash de contraseña y los valores por defecto", async () => {
    const email = `nuevo.${Date.now()}@test.com`;
    const phoneNumber = uniquePhoneNumber();
    const result = await registerPlayer(initialState, buildFormData({ email, password: "secreto123", phoneNumber }));

    // redirect() está mockeado como no-op (en producción interrumpe la ejecución lanzando),
    // así que el código continúa y la función retorna undefined implícitamente.
    expect(result).toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/login");

    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const saved = await players.findOne({
      where: { account: { email } },
      relations: { account: true },
    });

    expect(saved).not.toBeNull();
    expect(saved?.category).toBe("without_category");
    expect(saved?.scoring).toBe(0);
    expect(saved).toMatchObject({ names: "Ana", lastnames: "Gomez", phoneNumber });
    expect(saved?.account.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", saved!.account.passwordHash)).resolves.toBe(true);
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
    const count = await players.count({ where: { account: { email } } });
    expect(count).toBe(1);
  });

  it("devuelve un mensaje de teléfono duplicado y no crea una segunda cuenta", async () => {
    const phoneNumber = uniquePhoneNumber();
    await registerPlayer(initialState, buildFormData({ phoneNumber }));
    vi.mocked(redirect).mockClear();
    const email = `telefono.${Date.now()}@test.com`;

    const result = await registerPlayer(initialState, buildFormData({ email, phoneNumber }));

    expect(result.message).toBe("El teléfono ya está en uso.");
    expect(redirect).not.toHaveBeenCalled();

    const dataSource = await getDataSource();
    expect(await dataSource.getRepository("Account").count({ where: { email } })).toBe(0);
  });
});
