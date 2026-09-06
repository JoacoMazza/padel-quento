import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { PlayerCategory, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import {
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} from "@/src/actions/player";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

describe("player actions (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea un jugador con el hash de contraseña y los valores por defecto", async () => {
    const email = uniqueEmail("crear");

    const result = await createPlayer({
      email,
      password: "secreto123",
      names: "Ana",
      lastnames: "Gomez",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      email,
      role: Role.PLAYER,
      category: PlayerCategory.WITHOUT_CATEGORY,
      scoring: 0,
    });
    expect(result.data.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", result.data.passwordHash)).resolves.toBe(true);
  });

  it("no permite crear dos jugadores con el mismo correo", async () => {
    const email = uniqueEmail("duplicado");
    await createPlayer({ email, password: "secreto123", names: "A", lastnames: "B" });

    const result = await createPlayer({ email, password: "secreto123", names: "A", lastnames: "B" });

    expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
  });

  it("lista los jugadores creados", async () => {
    const email = uniqueEmail("listado");
    await createPlayer({ email, password: "secreto123", names: "A", lastnames: "B" });

    const result = await getPlayers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.some((p) => p.email === email)).toBe(true);
  });

  it("obtiene un jugador por id y null si no existe", async () => {
    const created = await createPlayer({
      email: uniqueEmail("porid"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const found = await getPlayerById(created.data.id);
    expect(found).toEqual({ success: true, data: expect.objectContaining({ id: created.data.id }) });

    const notFound = await getPlayerById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza los datos de un jugador y rehashea la contraseña si se provee", async () => {
    const created = await createPlayer({
      email: uniqueEmail("actualizar"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const result = await updatePlayer(created.data.id, {
      names: "Ana María",
      password: "otraClave456",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.names).toBe("Ana María");
    await expect(bcrypt.compare("otraClave456", result.data.passwordHash)).resolves.toBe(true);
  });

  it("devuelve error al actualizar un jugador inexistente", async () => {
    const result = await updatePlayer(999_999_999, { names: "Nadie" });

    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });

  it("elimina un jugador existente y falla al eliminarlo de nuevo", async () => {
    const created = await createPlayer({
      email: uniqueEmail("eliminar"),
      password: "secreto123",
      names: "A",
      lastnames: "B",
    });
    if (!created.success) throw new Error("expected success");

    const result = await deletePlayer(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deletePlayer(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El jugador no existe." });
  });
});
