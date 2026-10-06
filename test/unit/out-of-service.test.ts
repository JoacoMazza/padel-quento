import { describe, expect, it } from "vitest";
import { isOutOfServiceActive } from "@/src/domain/out-of-service";

describe("isOutOfServiceActive", () => {
  const outOfService = {
    fromDateTime: new Date("2026-10-01T09:00:00"),
    toDateTime: new Date("2026-10-01T12:00:00"),
  };

  it("no está activo antes de que empiece (bloqueo programado)", () => {
    expect(isOutOfServiceActive(outOfService, new Date("2026-10-01T08:59:59"))).toBe(false);
  });

  it("está activo desde su inicio", () => {
    expect(isOutOfServiceActive(outOfService, new Date("2026-10-01T09:00:00"))).toBe(true);
  });

  it("está activo durante el período", () => {
    expect(isOutOfServiceActive(outOfService, new Date("2026-10-01T11:59:59"))).toBe(true);
  });

  it("deja de estar activo al llegar su fin", () => {
    expect(isOutOfServiceActive(outOfService, new Date("2026-10-01T12:00:00"))).toBe(false);
  });
});
