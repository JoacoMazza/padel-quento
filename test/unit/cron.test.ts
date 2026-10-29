import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cancelExpiredMatches, awardAttendancePoints, extendFixedBookings } = vi.hoisted(() => ({
  cancelExpiredMatches: vi.fn(),
  awardAttendancePoints: vi.fn(),
  extendFixedBookings: vi.fn(),
}));
vi.mock("@/src/actions/match", () => ({ cancelExpiredMatches }));
vi.mock("@/src/actions/attendance", () => ({ awardAttendancePoints }));
vi.mock("@/src/actions/fixedBooking", () => ({ extendFixedBookings }));

import { runCronJob } from "@/src/lib/cron";

const ORIGINAL_ENV = process.env;
const SECRET = "secreto-de-prueba-123";

describe("runCronJob (procesos en segundo plano llamados por un programador externo)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: SECRET };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it.each([
    ["open-match-expiration", cancelExpiredMatches],
    ["attendance-points", awardAttendancePoints],
    ["fixed-booking-extension", extendFixedBookings],
  ])("corre %s con el secreto correcto", async (job, action) => {
    action.mockResolvedValue({ success: true, data: 3 });

    const result = await runCronJob(job, `Bearer ${SECRET}`);

    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 200, body: { job, processed: 3 } });
  });

  it.each([
    ["sin el encabezado", null],
    ["con otro secreto", "Bearer otro-secreto"],
    ["sin el prefijo Bearer", SECRET],
  ])("rechaza %s, sin correr nada", async (_case, authorization) => {
    const result = await runCronJob("attendance-points", authorization);

    expect(result.status).toBe(401);
    expect(awardAttendancePoints).not.toHaveBeenCalled();
  });

  it("si no está configurado CRON_SECRET no corre nada, ni siquiera con un encabezado vacío", async () => {
    delete process.env.CRON_SECRET;

    expect((await runCronJob("attendance-points", "Bearer ")).status).toBe(401);
    expect((await runCronJob("attendance-points", "Bearer undefined")).status).toBe(401);
    expect(awardAttendancePoints).not.toHaveBeenCalled();
  });

  it("responde 404 con un proceso que no existe", async () => {
    const result = await runCronJob("borrar-todo", `Bearer ${SECRET}`);

    expect(result.status).toBe(404);
  });

  it("responde 500 si el proceso falla", async () => {
    cancelExpiredMatches.mockResolvedValue({ success: false, error: "No se pudieron cancelar los partidos." });

    const result = await runCronJob("open-match-expiration", `Bearer ${SECRET}`);

    expect(result).toEqual({
      status: 500,
      body: { job: "open-match-expiration", error: "No se pudieron cancelar los partidos." },
    });
  });
});
