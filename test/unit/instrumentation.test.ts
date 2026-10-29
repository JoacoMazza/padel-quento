import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startOpenMatchExpirationJob, startAttendancePointsJob, startFixedBookingExtensionJob } = vi.hoisted(() => ({
  startOpenMatchExpirationJob: vi.fn(),
  startAttendancePointsJob: vi.fn(),
  startFixedBookingExtensionJob: vi.fn(),
}));
vi.mock("@/src/jobs/open-match-expiration", () => ({ startOpenMatchExpirationJob }));
vi.mock("@/src/jobs/attendance-points", () => ({ startAttendancePointsJob }));
vi.mock("@/src/jobs/fixed-booking-extension", () => ({ startFixedBookingExtensionJob }));

import { register } from "@/instrumentation";

const ORIGINAL_ENV = process.env;
const jobs = [startOpenMatchExpirationJob, startAttendancePointsJob, startFixedBookingExtensionJob];

describe("register (procesos en segundo plano al arrancar el servidor)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NEXT_RUNTIME: "nodejs" };
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("con un servidor permanente arranca los tres procesos", async () => {
    await register();

    for (const job of jobs) expect(job).toHaveBeenCalledTimes(1);
  });

  it("en Vercel no los arranca: ahí los corre el programador por /api/cron (ver src/lib/cron.ts)", async () => {
    process.env.VERCEL = "1";

    await register();

    for (const job of jobs) expect(job).not.toHaveBeenCalled();
  });
});
