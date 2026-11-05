import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_TIME_ZONE, applyClubTimeZone } from "@/src/lib/club-time-zone";
import { occurrenceStart, todayISO } from "@/src/domain/fixed-booking";

vi.mock("@/src/jobs/open-match-expiration", () => ({ startOpenMatchExpirationJob: vi.fn() }));
vi.mock("@/src/jobs/attendance-points", () => ({ startAttendancePointsJob: vi.fn() }));
vi.mock("@/src/jobs/fixed-booking-extension", () => ({ startFixedBookingExtensionJob: vi.fn() }));

import { register } from "@/instrumentation";

describe("zona horaria del club", () => {
  const originalTZ = process.env.TZ;
  const originalRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    // Como en un servidor desplegado en UTC.
    process.env.TZ = "UTC";
  });

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
    if (originalRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = originalRuntime;
  });

  it("es la de Argentina", () => {
    expect(CLUB_TIME_ZONE).toBe("America/Argentina/Buenos_Aires");
  });

  it("con la zona del club, las 18:00 de un turno fijo son las 18:00 en City Bell y no en UTC", () => {
    applyClubTimeZone();

    expect(occurrenceStart("2026-10-26", "18:00").toISOString()).toBe("2026-10-26T21:00:00.000Z");
  });

  it("con la zona del club, hoy es la fecha de City Bell aunque en UTC ya sea mañana", () => {
    applyClubTimeZone();

    expect(todayISO(new Date("2026-10-27T01:00:00Z"))).toBe("2026-10-26");
  });

  it("el servidor la aplica al arrancar", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    await register();

    expect(process.env.TZ).toBe(CLUB_TIME_ZONE);
  });

  it("la conexión que usan los seeds y los comandos de TypeORM también la aplica", async () => {
    vi.stubEnv("DATABASE_URL", process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/db");
    vi.resetModules();

    await import("@/src/lib/data-source");

    expect(process.env.TZ).toBe(CLUB_TIME_ZONE);
    vi.unstubAllEnvs();
  });
});
