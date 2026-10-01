import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDataSource } from "@/src/lib/db";
import { uniquePhoneNumber } from "./helpers";
import { getPlayersAdmin, blockPlayer, unblockPlayer, createPlayer } from "@/src/actions/player";
import { Role } from "@/src/domain/enums";

// ── mock de sesión de admin ───────────────────────────────────────────────────
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as any);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("admin player actions (integración con Postgres real)", () => {
  beforeAll(() => {
    mockAdminSession();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("getPlayersAdmin lista los jugadores existentes", async () => {
    // crear un jugador para asegurar que hay al menos uno
    await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("lista"),
      password: "pass123",
      names: "Lista",
      lastnames: "Test",
    });

    mockAdminSession();
    const result = await getPlayersAdmin();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    // todos los items tienen isBlocked definido
    result.data.forEach((p) => expect(typeof p.isBlocked).toBe("boolean"));
    // los datos personales salen del booker y el email de la cuenta
    expect(result.data.find((p) => p.names === "Lista")).toMatchObject({
      lastnames: "Test",
      email: expect.stringContaining("@test.com"),
      phoneNumber: expect.stringMatching(/^221\d+$/),
    });
  });

  it("blockPlayer marca isBlocked = true en la BD", async () => {
    const created = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("bloquear"),
      password: "pass123",
      names: "Bloquear",
      lastnames: "Test",
    });
    if (!created.success) throw new Error("expected success creando jugador");
    const id = created.data.id;

    mockAdminSession();
    const blockResult = await blockPlayer(id);
    expect(blockResult).toEqual({ success: true, data: null });

    // verificar directamente en la BD
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository("Player") as any;
    const player = await repo.findOne({ where: { id }, relations: { account: true } });
    expect(player?.account.isBlocked).toBe(true);
  });

  it("unblockPlayer marca isBlocked = false en la BD", async () => {
    // crear un jugador y bloquearlo primero
    const created = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: uniqueEmail("desbloquear"),
      password: "pass123",
      names: "Desbloquear",
      lastnames: "Test",
    });
    if (!created.success) throw new Error("expected success creando jugador");
    const id = created.data.id;

    mockAdminSession();
    await blockPlayer(id);

    mockAdminSession();
    const unblockResult = await unblockPlayer(id);
    expect(unblockResult).toEqual({ success: true, data: null });

    // verificar directamente en la BD
    const dataSource = await getDataSource();
    const repo = dataSource.getRepository("Player") as any;
    const player = await repo.findOne({ where: { id }, relations: { account: true } });
    expect(player?.account.isBlocked).toBe(false);
  });

  it("blockPlayer devuelve error si el jugador no existe", async () => {
    mockAdminSession();
    const result = await blockPlayer(999_999_999);
    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });

  it("unblockPlayer devuelve error si el jugador no existe", async () => {
    mockAdminSession();
    const result = await unblockPlayer(999_999_999);
    expect(result).toEqual({ success: false, error: "El jugador no existe." });
  });
});

