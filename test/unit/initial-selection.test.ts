import { describe, expect, it } from "vitest";
import { parseInitialSelection } from "@/app/bookings/initial-selection";

describe("parseInitialSelection", () => {
  it("lee la fecha, la cancha y el horario que vienen en la URL", () => {
    expect(parseInitialSelection({ date: "2026-10-20", court: "3", time: "19:30" })).toEqual({
      date: "2026-10-20",
      courtId: 3,
      time: "19:30",
    });
  });

  it("ignora la selección si falta algún dato", () => {
    expect(parseInitialSelection({ date: "2026-10-20", court: "3" })).toBeUndefined();
    expect(parseInitialSelection({})).toBeUndefined();
  });

  it("ignora valores con formato inválido", () => {
    expect(parseInitialSelection({ date: "20/10/2026", court: "3", time: "19:30" })).toBeUndefined();
    expect(parseInitialSelection({ date: "2026-10-20", court: "tres", time: "19:30" })).toBeUndefined();
    expect(parseInitialSelection({ date: "2026-10-20", court: "3", time: "7:30pm" })).toBeUndefined();
  });

  it("si un parámetro viene repetido usa el primero", () => {
    expect(parseInitialSelection({ date: ["2026-10-20", "2026-10-21"], court: "3", time: "19:30" })?.date).toBe(
      "2026-10-20",
    );
  });
});
