import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { BookingState } from "@/src/domain/enums";
import { PENALTY_POINTS } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, updateBooking } from "@/src/actions/booking";
import { getProfileData } from "@/src/actions/profile";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

describe("penalización por cancelación tardía (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  async function createTestPlayer(prefix: string) {
    const email = uniqueEmail(prefix);
    const player = await createPlayer({
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: player.data.id, email };
  }

  it("descuenta la penalización al cancelar un turno a menos de 3 horas", async () => {
    const player = await createTestPlayer("cancela-tarde");
    const created = await createBooking({
      fromDateTime: new Date(Date.now() + 2 * 60 * 60_000),
      playerId: player.id,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateBooking(created.data.id, { bookingState: BookingState.CANCELLED });
    expect(result.success).toBe(true);

    const profile = await getProfileData(player.email);
    expect(profile?.scoring).toBe(-PENALTY_POINTS);
  });

  it("no descuenta puntos al cancelar un turno con 3 horas o más de anticipación", async () => {
    const player = await createTestPlayer("cancela-a-tiempo");
    const created = await createBooking({
      fromDateTime: new Date(Date.now() + 5 * 60 * 60_000),
      playerId: player.id,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateBooking(created.data.id, { bookingState: BookingState.CANCELLED });
    expect(result.success).toBe(true);

    const profile = await getProfileData(player.email);
    expect(profile?.scoring).toBe(0);
  });
});
