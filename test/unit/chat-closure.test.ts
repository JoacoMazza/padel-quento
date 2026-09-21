import { describe, expect, it } from "vitest";
import { isChatClosed } from "@/src/domain/chat-closure";

describe("isChatClosed", () => {
  const booking = { fromDateTime: new Date("2026-10-01T18:00:00"), durationMinutes: 90 };

  it("está abierto antes de que empiece el turno", () => {
    expect(isChatClosed(booking, new Date("2026-10-01T17:59:59"))).toBe(false);
  });

  it("está abierto mientras el turno está en juego", () => {
    expect(isChatClosed(booking, new Date("2026-10-01T19:29:59"))).toBe(false);
  });

  it("se cierra exactamente al finalizar el horario del turno", () => {
    expect(isChatClosed(booking, new Date("2026-10-01T19:30:00"))).toBe(true);
  });

  it("sigue cerrado en los días posteriores", () => {
    expect(isChatClosed(booking, new Date("2026-10-05T10:00:00"))).toBe(true);
  });

  it("usa la duración del turno para calcular el fin", () => {
    const longBooking = { ...booking, durationMinutes: 120 };

    expect(isChatClosed(longBooking, new Date("2026-10-01T19:30:00"))).toBe(false);
    expect(isChatClosed(longBooking, new Date("2026-10-01T20:00:00"))).toBe(true);
  });
});
