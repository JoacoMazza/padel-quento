import { describe, expect, it } from "vitest";
import { NO_SHOW_PENALTY_REASON, bookerAttended, hasNoShow, isPresent } from "@/src/domain/attendance";

describe("bookerAttended", () => {
  it("quien reservó asistió salvo que tenga una inasistencia ligada al turno", () => {
    expect(bookerAttended({ penalties: [] })).toBe(true);
    expect(bookerAttended({})).toBe(true);
    expect(bookerAttended({ penalties: [{ reason: "Asistencia a turno reservado" }] })).toBe(true);
    expect(bookerAttended({ penalties: [{ reason: NO_SHOW_PENALTY_REASON }] })).toBe(false);
  });
});

describe("asistencia de un jugador de un partido abierto", () => {
  it("estuvo si asistió al menos uno de su grupo", () => {
    expect(isPresent({ attendedCount: 1 })).toBe(true);
    expect(isPresent({ attendedCount: 0 })).toBe(false);
  });

  it("tiene una inasistencia si faltó alguien de su grupo", () => {
    expect(hasNoShow({ attendedCount: 2, playersCount: 2 })).toBe(false);
    expect(hasNoShow({ attendedCount: 1, playersCount: 2 })).toBe(true);
  });
});
