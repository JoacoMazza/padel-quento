import { describe, expect, it } from "vitest";
import { formatDuration, formatPercent, formatSlotTime } from "@/app/admin/metrics-format";

describe("metrics format", () => {
  describe("formatDuration", () => {
    it("muestra horas y minutos en lugar de horas decimales", () => {
      expect(formatDuration(75)).toBe("1h 15m");
    });

    it("omite los minutos si son horas exactas y las horas si es menos de una", () => {
      expect(formatDuration(120)).toBe("2h");
      expect(formatDuration(45)).toBe("45m");
    });

    it("muestra 0h sin tiempo y redondea a minutos enteros", () => {
      expect(formatDuration(0)).toBe("0h");
      expect(formatDuration(89.6)).toBe("1h 30m");
    });

    it("no pasa las horas a días", () => {
      expect(formatDuration(1740)).toBe("29h");
    });
  });

  describe("formatPercent", () => {
    it("muestra el porcentaje con dos decimales", () => {
      expect(formatPercent(0.625)).toBe("62,50%");
      expect(formatPercent(2 / 3)).toBe("66,67%");
      expect(formatPercent(1)).toBe("100,00%");
      expect(formatPercent(0)).toBe("0,00%");
    });
  });

  describe("formatSlotTime", () => {
    it("muestra la hora del turno sin los minutos cuando es en punto", () => {
      expect(formatSlotTime(9 * 60)).toBe("9");
      expect(formatSlotTime(10 * 60 + 30)).toBe("10:30");
      expect(formatSlotTime(12 * 60)).toBe("12");
    });
  });
});
