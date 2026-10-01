import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authOptions } from "@/src/lib/auth";
import { Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createAdmin } from "@/src/actions/admin";
import { createPlayer } from "@/src/actions/player";
import { uniquePhoneNumber } from "./helpers";

type Credentials = { email?: string; password?: string } | undefined;

function getAuthorize() {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: Credentials) => Promise<unknown> };
  };
  return provider.options.authorize;
}

describe("authorize - CredentialsProvider (integración con Postgres real)", () => {
  const email = `auth.${Date.now()}@test.com`;
  const emailBlocked = `blocked.${Date.now()}@test.com`;
  const emailAdmin = `admin.${Date.now()}@test.com`;
  const password = "claveSegura123";

  beforeAll(async () => {
    // jugador normal
    await createPlayer({ email, password, names: "Login", lastnames: "Test", phoneNumber: uniquePhoneNumber() });
    // jugador bloqueado
    const blocked = await createPlayer({
      email: emailBlocked,
      password,
      names: "Bloqueado",
      lastnames: "Test",
      phoneNumber: uniquePhoneNumber(),
    });
    if (!blocked.success) throw new Error("no se pudo crear el jugador bloqueado de prueba");
    const dataSource = await getDataSource();
    await dataSource.getRepository("Account").update(blocked.data.account.id, { isBlocked: true });
    // administrador
    await createAdmin({ email: emailAdmin, password, names: "Admin", lastnames: "Login" });
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("autentica con credenciales correctas, normalizando mayúsculas y espacios en el email", async () => {
    const result = await getAuthorize()({ email: ` ${email.toUpperCase()} `, password });

    expect(result).toMatchObject({ email, name: "Login Test", role: Role.PLAYER });
  });

  it("deduce el rol de administrador de la cuenta asociada a un Admin", async () => {
    const result = await getAuthorize()({ email: emailAdmin, password });

    expect(result).toMatchObject({ email: emailAdmin, name: "Admin Login", role: Role.ADMIN });
  });

  it("rechaza una contraseña incorrecta", async () => {
    const result = await getAuthorize()({ email, password: "incorrecta" });
    expect(result).toBeNull();
  });

  it("rechaza un email que no existe", async () => {
    const result = await getAuthorize()({ email: "no-existe@test.com", password });
    expect(result).toBeNull();
  });

  it("rechaza el login de un usuario bloqueado aunque la contraseña sea correcta", async () => {
    const result = await getAuthorize()({ email: emailBlocked, password });
    expect(result).toBeNull();
  });
});
