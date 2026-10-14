import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { getDataSource } from "@/src/lib/db";
import { createAdmin, getAdmins, getAdminById, updateAdmin, deleteAdmin } from "@/src/actions/admin";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

let nextDni = 40_000_000 + Math.floor(Math.random() * 1_000_000);
function uniqueDni() {
  return nextDni++;
}

describe("admin actions (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea un administrador junto con su cuenta y el hash de contraseña", async () => {
    const email = uniqueEmail("crear");

    const result = await createAdmin({
      email,
      password: "secreto123",
      names: "Admin",
      lastnames: "Uno",
      dni: 30111222,
    });


    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ names: "Admin", lastnames: "Uno", dni: 30111222, account: { email } });
    expect(result.data.account.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", result.data.account.passwordHash)).resolves.toBe(true);
  });

  it("no permite crear dos cuentas con el mismo correo", async () => {
    const email = uniqueEmail("duplicado");
    await createAdmin({ email, password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });

    const result = await createAdmin({ email, password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });

    expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
  });

  it("no permite crear dos administradores con el mismo DNI", async () => {
    const dni = uniqueDni();
    const first = await createAdmin({ email: uniqueEmail("dni1"), password: "secreto123", names: "A", lastnames: "B", dni });
    expect(first.success).toBe(true);

    const result = await createAdmin({ email: uniqueEmail("dni2"), password: "secreto123", names: "C", lastnames: "D", dni });

    expect(result).toEqual({ success: false, error: "Ya hay un administrador con ese DNI." });
    // La transacción se deshace: no queda la cuenta huérfana del segundo intento.
    const dataSource = await getDataSource();
    expect(await dataSource.getRepository("Admin").count({ where: { dni } })).toBe(1);
  });

  it("no permite pasarle a un administrador el DNI de otro", async () => {
    const dni = uniqueDni();
    await createAdmin({ email: uniqueEmail("dueno"), password: "secreto123", names: "A", lastnames: "B", dni });
    const other = await createAdmin({ email: uniqueEmail("otro"), password: "secreto123", names: "C", lastnames: "D", dni: uniqueDni() });
    if (!other.success) throw new Error("expected success");

    const result = await updateAdmin(other.data.id, { dni });

    expect(result).toEqual({ success: false, error: "Ya hay un administrador con ese DNI." });
  });

  it("varios administradores anteriores pueden seguir sin DNI hasta que se los edite", async () => {
    const dataSource = await getDataSource();
    const accounts = dataSource.getRepository("Account");
    const admins = dataSource.getRepository("Admin");
    for (const prefix of ["viejo1", "viejo2"]) {
      const account = await accounts.save(accounts.create({ email: uniqueEmail(prefix), passwordHash: "x" }));
      await admins.save(admins.create({ account, names: "Viejo", lastnames: prefix, dni: null }));
    }

    expect(await admins.count({ where: { lastnames: "viejo1" } })).toBe(1);
    expect(await admins.count({ where: { lastnames: "viejo2" } })).toBe(1);
  });

  it("lista los administradores creados", async () => {
    const email = uniqueEmail("listado");
    await createAdmin({ email, password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });

    const result = await getAdmins();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.some((admin) => admin.account.email === email)).toBe(true);
  });

  it("obtiene un administrador por id y null si no existe", async () => {
    const created = await createAdmin({ email: uniqueEmail("porid"), password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });
    if (!created.success) throw new Error("expected success");

    const found = await getAdminById(created.data.id);
    expect(found).toEqual({ success: true, data: expect.objectContaining({ id: created.data.id }) });

    const notFound = await getAdminById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza los datos de un administrador y rehashea la contraseña si se provee", async () => {
    const created = await createAdmin({ email: uniqueEmail("actualizar"), password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });
    if (!created.success) throw new Error("expected success");

    const result = await updateAdmin(created.data.id, { names: "Administrador", password: "otraClave456" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.names).toBe("Administrador");
    await expect(bcrypt.compare("otraClave456", result.data.account.passwordHash)).resolves.toBe(true);
  });

  it("devuelve error al actualizar un administrador inexistente", async () => {
    const result = await updateAdmin(999_999_999, { names: "Nadie" });

    expect(result).toEqual({ success: false, error: "El administrador no existe." });
  });

  it("elimina un administrador junto con su cuenta y falla al eliminarlo de nuevo", async () => {
    const email = uniqueEmail("eliminar");
    const created = await createAdmin({ email, password: "secreto123", names: "A", lastnames: "B", dni: uniqueDni() });
    if (!created.success) throw new Error("expected success");

    const result = await deleteAdmin(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const dataSource = await getDataSource();
    expect(await dataSource.getRepository("Account").count({ where: { email } })).toBe(0);

    const secondAttempt = await deleteAdmin(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El administrador no existe." });
  });
});
