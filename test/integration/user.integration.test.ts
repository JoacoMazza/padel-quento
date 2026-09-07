import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createUser, getUsers, getUserById, updateUser, deleteUser } from "@/src/actions/user";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

describe("user actions (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea un usuario con el hash de contraseña y rol ADMIN por defecto", async () => {
    const email = uniqueEmail("crear");

    const result = await createUser({
      email,
      password: "secreto123",
      names: "Admin",
      lastnames: "Uno",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ email, role: Role.ADMIN });
    expect(result.data.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", result.data.passwordHash)).resolves.toBe(true);
  });

  it("no permite crear dos usuarios con el mismo correo", async () => {
    const email = uniqueEmail("duplicado");
    await createUser({ email, password: "secreto123", names: "A", lastnames: "B" });

    const result = await createUser({ email, password: "secreto123", names: "A", lastnames: "B" });

    expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
  });

  it("lista los usuarios creados", async () => {
    const email = uniqueEmail("listado");
    await createUser({ email, password: "secreto123", names: "A", lastnames: "B" });

    const result = await getUsers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.some((u) => u.email === email)).toBe(true);
  });

  it("obtiene un usuario por id y null si no existe", async () => {
    const created = await createUser({
      email: uniqueEmail("porid"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const found = await getUserById(created.data.id);
    expect(found).toEqual({ success: true, data: expect.objectContaining({ id: created.data.id }) });

    const notFound = await getUserById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza los datos de un usuario y rehashea la contraseña si se provee", async () => {
    const created = await createUser({
      email: uniqueEmail("actualizar"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateUser(created.data.id, {
      names: "Administrador",
      password: "otraClave456",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.names).toBe("Administrador");
    await expect(bcrypt.compare("otraClave456", result.data.passwordHash)).resolves.toBe(true);
  });

  it("devuelve error al actualizar un usuario inexistente", async () => {
    const result = await updateUser(999_999_999, { names: "Nadie" });

    expect(result).toEqual({ success: false, error: "El usuario no existe." });
  });

  it("elimina un usuario existente y falla al eliminarlo de nuevo", async () => {
    const created = await createUser({
      email: uniqueEmail("eliminar"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const result = await deleteUser(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteUser(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El usuario no existe." });
  });
});
