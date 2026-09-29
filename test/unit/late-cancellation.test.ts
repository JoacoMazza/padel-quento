import { describe, expect, it } from "vitest";
import { isLateCancellation } from "@/src/domain/late-cancellation";

describe("isLateCancellation", () => {
  const fromDateTime = new Date("2026-10-01T18:00:00");

  it("no es tardía si faltan más de 3 horas para el turno", () => {
    expect(isLateCancellation(fromDateTime, new Date("2026-10-01T14:00:00"))).toBe(false);
  });

  it("no es tardía si faltan exactamente 3 horas para el turno", () => {
    expect(isLateCancellation(fromDateTime, new Date("2026-10-01T15:00:00"))).toBe(false);
  });

  it("es tardía apenas faltan menos de 3 horas para el turno", () => {
    expect(isLateCancellation(fromDateTime, new Date("2026-10-01T15:00:01"))).toBe(true);
  });

  it("es tardía si faltan menos de 3 horas para el turno", () => {
    expect(isLateCancellation(fromDateTime, new Date("2026-10-01T17:30:00"))).toBe(true);
  });

  it("es tardía si el turno ya empezó", () => {
    expect(isLateCancellation(fromDateTime, new Date("2026-10-01T18:30:00"))).toBe(true);
  });
});
