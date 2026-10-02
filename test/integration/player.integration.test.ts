import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import {
  createPlayer,
  getPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} from "@/src/actions/player";
import { uniquePhoneNumber } from "./helpers";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

function newPlayerInput(prefix: string) {
  return {
    email: uniqueEmail(prefix),
    password: "secreto123",
    names: "A",
    lastnames: "B",
    phoneNumber: uniquePhoneNumber(),
  };
}

describe("player actions (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea el jugador (que es un booker) junto con su cuenta, con el hash de contraseña y los valores por defecto", async () => {
    const email = uniqueEmail("crear");
    const phoneNumber = uniquePhoneNumber();

    const result = await createPlayer({
      email,
      password: "secreto123",
      names: "Ana",
      lastnames: "Gomez",
      phoneNumber,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      names: "Ana",
      lastnames: "Gomez",
      phoneNumber,
      category: PlayerCategory.WITHOUT_CATEGORY,
      scoring: 0,
      account: { email, isBlocked: false, photoUrl: null },
    });

    const dataSource = await getDataSource();
    const asBooker = await dataSource.getRepository("Booker").findOne({ where: { id: result.data.id } });
    expect(asBooker).toMatchObject({ phoneNumber });
    expect(result.data.account.passwordHash).not.toBe("secreto123");
    await expect(bcrypt.compare("secreto123", result.data.account.passwordHash)).resolves.toBe(true);
  });

  it("no permite crear dos jugadores con el mismo correo", async () => {
    const input = newPlayerInput("duplicado");
    await createPlayer(input);

    const result = await createPlayer({ ...input, phoneNumber: uniquePhoneNumber() });

    expect(result).toEqual({ success: false, error: "El correo ya está en uso." });
  });

  it("no permite crear dos jugadores con el mismo teléfono y no deja una cuenta huérfana", async () => {
    const input = newPlayerInput("telefono");
    await createPlayer(input);
    const secondEmail = uniqueEmail("telefono-2");

    const result = await createPlayer({ ...input, email: secondEmail });

    expect(result).toEqual({ success: false, error: "El teléfono ya está en uso." });
    const dataSource = await getDataSource();
    expect(await dataSource.getRepository("Account").count({ where: { email: secondEmail } })).toBe(0);
  });

  it("lista los jugadores creados con su cuenta", async () => {
    const input = newPlayerInput("listado");
    await createPlayer(input);

    const result = await getPlayers();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const found = result.data.find((p) => p.account.email === input.email);
    expect(found?.phoneNumber).toBe(input.phoneNumber);
  });

  it("obtiene un jugador por id y null si no existe", async () => {
    const created = await createPlayer(newPlayerInput("porid"));
    if (!created.success) throw new Error("expected success");

    const found = await getPlayerById(created.data.id);
    expect(found).toEqual({
      success: true,
      data: expect.objectContaining({ id: created.data.id, names: "A" }),
    });

    const notFound = await getPlayerById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza los datos personales, de la cuenta y del jugador, y rehashea la contraseña si se provee", async () => {
    const created = await createPlayer(newPlayerInput("actualizar"));
    if (!created.success) throw new Error("expected success");

    const result = await updatePlayer(created.data.id, {
      names: "Ana María",
      category: PlayerCategory.FIFTH,
      password: "otraClave456",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.names).toBe("Ana María");
    expect(result.data.category).toBe(PlayerCategory.FIFTH);
    await expect(bcrypt.compare("otraClave456", result.data.account.passwordHash)).resolves.toBe(true);

    const reloaded = await getPlayerById(created.data.id);
    if (!reloaded.success) throw new Error("expected success");
    expect(reloaded.data?.names).toBe("Ana María");
  });

  it("devuelve error al actualizar un jugador inexistente", async () => {
    const result = await updatePlayer(999_999_999, { names: "Nadie" });

    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });

  it("elimina un jugador existente junto con su cuenta y falla al eliminarlo de nuevo", async () => {
    const input = newPlayerInput("eliminar");
    const created = await createPlayer(input);
    if (!created.success) throw new Error("expected success");

    const result = await deletePlayer(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const dataSource = await getDataSource();
    expect(await dataSource.getRepository("Account").count({ where: { email: input.email } })).toBe(0);

    const secondAttempt = await deletePlayer(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El jugador no existe." });
  });
});
