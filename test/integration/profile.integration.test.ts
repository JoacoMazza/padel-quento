import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { PlayerCategory } from "@/src/domain/enums";
import { Player } from "@/src/entities/Player";
import { getDataSource } from "@/src/lib/db";
import {
  getProfileData,
  recordPointsMovement,
  updatePlayerProfile,
  type ProfileState,
} from "@/src/actions/profile";

const initialState: ProfileState = {};

describe("Profile Server Actions & Points (Integración Postgres)", () => {
  let playerEmail: string;
  let playerId: number;

  beforeEach(async () => {
    vi.mocked(getServerSession).mockClear();

    playerEmail = `jugador.perfil.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;

    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const player = players.create({
      names: "Esteban",
      lastnames: "Quito",
      email: playerEmail,
      passwordHash: "hash123",
      category: PlayerCategory.SIXTH,
      scoring: 0,
      photoUrl: null,
    });

    const saved = await players.save(player);
    playerId = saved.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("recupera los datos de perfil y un saldo de puntos de 0 cuando no hay movimientos", async () => {
    const profile = await getProfileData(playerEmail);

    expect(profile).not.toBeNull();
    expect(profile?.names).toBe("Esteban");
    expect(profile?.lastnames).toBe("Quito");
    expect(profile?.category).toBe(PlayerCategory.SIXTH);
    expect(profile?.scoring).toBe(0);
    expect(profile?.movements).toEqual([]);
  });

  it("modifica el nombre y categoría del jugador y los persiste inmediatamente", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { email: playerEmail, name: "Esteban Quito" },
    });

    const formData = new FormData();
    formData.set("names", "Esteban Modificado");
    formData.set("lastnames", "Quito Nuevo");
    formData.set("category", PlayerCategory.THIRD);
    formData.set("photoUrl", "https://ejemplo.com/foto.png");

    const result = await updatePlayerProfile(initialState, formData);

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/perfil actualizado/i);

    // Verificar persistencia inmediata en la BD
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const updated = await players.findOne({ where: { email: playerEmail } });

    expect(updated?.names).toBe("Esteban Modificado");
    expect(updated?.lastnames).toBe("Quito Nuevo");
    expect(updated?.category).toBe(PlayerCategory.THIRD);
    expect(updated?.photoUrl).toBe("https://ejemplo.com/foto.png");
  });

  it("registra movimientos de bonificación y penalización y calcula el saldo neto en solo lectura", async () => {
    // 1. Registrar bonificación de +50 puntos
    const ok1 = await recordPointsMovement(
      playerId,
      50,
      "bonus",
      "Bonificación por victoria en torneo",
    );
    expect(ok1).toBe(true);

    // 2. Registrar penalización de -15 puntos
    const ok2 = await recordPointsMovement(
      playerId,
      -15,
      "penalty",
      "Penalización por cancelación tardía",
    );
    expect(ok2).toBe(true);

    // 3. Obtener perfil y verificar saldo neto acumulado (50 - 15 = 35)
    const profile = await getProfileData(playerEmail);

    expect(profile?.scoring).toBe(35);
    expect(profile?.movements.length).toBe(2);
    expect(profile?.movements[0].amount).toBe(-15);
    expect(profile?.movements[0].type).toBe("penalty");
    expect(profile?.movements[1].amount).toBe(50);
    expect(profile?.movements[1].type).toBe("bonus");

    // Verificar en BD que scoring se mantiene sincronizado
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const playerInDb = await players.findOne({ where: { id: playerId } });
    expect(playerInDb?.scoring).toBe(35);
  });
});
