import { describe, expect, it } from "vitest";
import { dateToClockLabel, dateToTimeLabel, minutesToTimeLabel } from "@/src/domain/time-format";

describe("formato de horas (siempre HH:MM, con el cero adelante)", () => {
  describe("minutesToTimeLabel", () => {
    it("muestra las horas en punto con sus minutos", () => {
      expect(minutesToTimeLabel(9 * 60)).toBe("09:00");
      expect(minutesToTimeLabel(12 * 60)).toBe("12:00");
      expect(minutesToTimeLabel(0)).toBe("00:00");
    });

    it("muestra las medias horas", () => {
      expect(minutesToTimeLabel(10 * 60 + 30)).toBe("10:30");
      expect(minutesToTimeLabel(23 * 60 + 30)).toBe("23:30");
    });
  });

  describe("dateToTimeLabel", () => {
    it("toma la hora local de la fecha", () => {
      expect(dateToTimeLabel(new Date(2026, 9, 12, 9, 0))).toBe("09:00");
      expect(dateToTimeLabel(new Date(2026, 9, 12, 18, 30))).toBe("18:30");
    });
  });

  describe("dateToClockLabel", () => {
    it("incluye los segundos, también con el cero adelante", () => {
      expect(dateToClockLabel(new Date(2026, 9, 12, 9, 5, 7))).toBe("09:05:07");
      expect(dateToClockLabel(new Date(2026, 9, 12, 21, 40, 0))).toBe("21:40:00");
    });
  });
});
