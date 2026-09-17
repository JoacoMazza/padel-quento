import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { User } from "@/src/entities/User";

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
  const password = "claveSegura123";

  beforeAll(async () => {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");
    // usuario normal
    await users.save(
      users.create({
        email,
        names: "Login",
        lastnames: "Test",
        passwordHash: await bcrypt.hash(password, 12),
      } as User),
    );
    // usuario bloqueado
    await users.save(
      users.create({
        email: emailBlocked,
        names: "Bloqueado",
        lastnames: "Test",
        passwordHash: await bcrypt.hash(password, 12),
        isBlocked: true,
      } as User),
    );
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("autentica con credenciales correctas, normalizando mayúsculas y espacios en el email", async () => {
    const result = await getAuthorize()({ email: ` ${email.toUpperCase()} `, password });

    expect(result).toMatchObject({ email, name: "Login Test" });
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
