import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { authOptions } from "@/src/lib/auth";
import { AdminAccessLevel, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
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
  const emailStaff = `staff.${Date.now()}@test.com`;
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
    // administradores: el dueño y un trabajador (createAdmin es solo para el dueño, así que van directo a la base)
    const passwordHash = await bcrypt.hash(password, 4);
    const accounts = dataSource.getRepository("Account");
    const admins = dataSource.getRepository("Admin");
    for (const [adminEmail, lastnames, accessLevel] of [
      [emailAdmin, "Login", AdminAccessLevel.OWNER],
      [emailStaff, "Staff", AdminAccessLevel.STAFF],
    ] as const) {
      const account = await accounts.save(accounts.create({ email: adminEmail, passwordHash }));
      await admins.save(admins.create({ account, names: "Admin", lastnames, dni: null, accessLevel }));
    }
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

  it("indica si el administrador es el dueño o un trabajador", async () => {
    expect(await getAuthorize()({ email: emailAdmin, password })).toMatchObject({ role: Role.ADMIN, isOwner: true });
    expect(await getAuthorize()({ email: emailStaff, password })).toMatchObject({ role: Role.ADMIN, isOwner: false });
    expect(await getAuthorize()({ email, password })).toMatchObject({ role: Role.PLAYER, isOwner: false });
  });

  it("lleva isOwner del login a la sesión", async () => {
    const user = await getAuthorize()({ email: emailAdmin, password });
    const callbacks = authOptions.callbacks!;
    const token = await callbacks.jwt!({ token: {}, user } as never);
    const session = await callbacks.session!({ session: { user: {}, expires: "" }, token } as never);

    expect((session as { user: { isOwner?: boolean } }).user.isOwner).toBe(true);
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
