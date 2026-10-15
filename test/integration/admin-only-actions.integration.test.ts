import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DayOfWeek, OutOfServiceReason, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import {
  createOutOfService,
  deleteOutOfService,
  endOutOfService,
  updateOutOfService,
} from "@/src/actions/outOfService";
import { createSchedule, deleteSchedule, updateSchedule } from "@/src/actions/schedule";
import { createPlayer, deletePlayer, getPlayerById, getPlayers, updatePlayer } from "@/src/actions/player";
import { getScheduleBoardData } from "@/src/actions/scheduleBoard";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

const NOT_SIGNED_IN = "No autenticado";
const NOT_ADMIN = "Acceso denegado: Se requieren permisos de Administrador";

function signInAs(role: Role | null) {
  vi.mocked(getServerSession).mockResolvedValue(role ? ({ user: { email: "x@test.com", role } } as never) : null);
}

/**
 * Acciones de administración que se pueden llamar como Server Actions: sin
 * sesión de administrador se rechazan y no cambian nada.
 */
describe("acciones solo para administradores (integración con Postgres real)", () => {
  let courtId: number;
  let scheduleId: number;
  let outOfServiceId: number;
  let playerId: number;

  beforeAll(async () => {
    signInAs(Role.ADMIN);
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error(court.error);
    courtId = court.data.id;
    const schedule = await createSchedule({
      dayOfWeek: DayOfWeek.MONDAY,
      openingTime: "09:00:00" as unknown as Date,
      closingTime: "23:00:00" as unknown as Date,
      courtId,
    });
    if (!schedule.success) throw new Error(schedule.error);
    scheduleId = schedule.data.id;
    const block = await createOutOfService({
      courtId,
      fromDateTime: new Date(Date.now() + 400 * 24 * 60 * 60_000),
      toDateTime: new Date(Date.now() + 401 * 24 * 60 * 60_000),
      reason: OutOfServiceReason.CLEANING,
    });
    if (!block.success) throw new Error(block.error);
    outOfServiceId = block.data.id;
    const player = await createPlayer({
      email: `protegido.${Date.now()}@test.com`,
      password: "secreto123",
      names: "Protegido",
      lastnames: "Test",
      phoneNumber: uniquePhoneNumber(),
    });
    if (!player.success) throw new Error(player.error);
    playerId = player.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  const calls = {
    createOutOfService: () =>
      createOutOfService({
        courtId,
        fromDateTime: new Date(Date.now() + 410 * 24 * 60 * 60_000),
        toDateTime: new Date(Date.now() + 411 * 24 * 60 * 60_000),
        reason: OutOfServiceReason.OTHER,
      }),
    updateOutOfService: () => updateOutOfService(outOfServiceId, { description: "cambiado" }),
    endOutOfService: () => endOutOfService(outOfServiceId),
    deleteOutOfService: () => deleteOutOfService(outOfServiceId),
    createSchedule: () =>
      createSchedule({
        dayOfWeek: DayOfWeek.TUESDAY,
        openingTime: "09:00:00" as unknown as Date,
        closingTime: "23:00:00" as unknown as Date,
        courtId,
      }),
    updateSchedule: () => updateSchedule(scheduleId, { closingTime: "20:00:00" as unknown as Date }),
    deleteSchedule: () => deleteSchedule(scheduleId),
    getPlayers: () => getPlayers(),
    getPlayerById: () => getPlayerById(playerId),
    updatePlayer: () => updatePlayer(playerId, { names: "Cambiado" }),
    deletePlayer: () => deletePlayer(playerId),
    getScheduleBoardData: () => getScheduleBoardData(),
  };

  for (const [name, call] of Object.entries(calls)) {
    it(`${name} rechaza a quien no inició sesión`, async () => {
      signInAs(null);
      expect(await call()).toEqual({ success: false, error: NOT_SIGNED_IN });
    });

    it(`${name} rechaza a un jugador`, async () => {
      signInAs(Role.PLAYER);
      expect(await call()).toEqual({ success: false, error: NOT_ADMIN });
    });
  }

  it("lo rechazado no cambió nada", async () => {
    signInAs(Role.ADMIN);
    const dataSource = await getDataSource();

    expect(await dataSource.getRepository("OutOfService").count({ where: { court: { id: courtId } } })).toBe(1);
    expect(await dataSource.getRepository("Schedule").count({ where: { court: { id: courtId } } })).toBe(1);
    const player = await getPlayerById(playerId);
    expect(player.success && player.data?.names).toBe("Protegido");
  });
});
