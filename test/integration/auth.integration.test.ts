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
  const password = "claveSegura123";

  beforeAll(async () => {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");
    await users.save(
      users.create({
        email,
        names: "Login",
        lastnames: "Test",
        passwordHash: await bcrypt.hash(password, 12),
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
});
