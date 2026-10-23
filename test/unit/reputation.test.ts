import { describe, expect, it } from "vitest";
import { BookingState, ReviewLevel } from "@/src/domain/enums";
import { NEGATIVE_REVIEW_POINTS } from "@/src/domain/constants";
import {
  canReviewMatch,
  isWithinReviewWindow,
  negativeReviewPoints,
  reputationAlerts,
  summarizeReputation,
} from "@/src/domain/reputation";

function review(overrides: Partial<{ level: ReviewLevel; goodAttitude: boolean; onTime: boolean }> = {}) {
  return { level: ReviewLevel.AS_DECLARED, goodAttitude: true, onTime: true, ...overrides };
}

describe("summarizeReputation", () => {
  it("calcula el porcentaje de puntualidad, buena actitud y nivel acorde a la categoría", () => {
    const summary = summarizeReputation([
      review(),
      review({ onTime: false }),
      review({ level: ReviewLevel.LOWER }),
      review({ goodAttitude: false, level: ReviewLevel.LOWER }),
    ]);

    expect(summary).toEqual({
      reviews: 4,
      enough: true,
      onTimePct: 75,
      goodAttitudePct: 75,
      levelAsDeclaredPct: 50,
      levelLowerPct: 50,
      levelHigherPct: 0,
    });
  });

  it("redondea los porcentajes", () => {
    const summary = summarizeReputation([review(), review(), review({ onTime: false })]);

    expect(summary.onTimePct).toBe(67);
  });

  it("con menos de 3 reseñas indica que todavía no alcanzan para mostrarla", () => {
    expect(summarizeReputation([review(), review()]).enough).toBe(false);
    expect(summarizeReputation([]).enough).toBe(false);
    expect(summarizeReputation([]).reviews).toBe(0);
  });
});

describe("reputationAlerts", () => {
  it("no marca nada si todo está por encima del 70%", () => {
    expect(reputationAlerts(summarizeReputation([review(), review(), review()]))).toEqual([]);
  });

  it("marca la puntualidad y la actitud por debajo del 70%", () => {
    const summary = summarizeReputation([
      review({ onTime: false, goodAttitude: false }),
      review({ onTime: false }),
      review(),
    ]);

    expect(reputationAlerts(summary)).toEqual(["Puntualidad baja: 33%", "Actitud: solo el 67% la considera buena"]);
  });

  it("si el nivel no coincide, indica si la mayoría lo ve por debajo o por encima de su categoría", () => {
    const lower = summarizeReputation([
      review({ level: ReviewLevel.LOWER }),
      review({ level: ReviewLevel.LOWER }),
      review(),
    ]);
    const higher = summarizeReputation([
      review({ level: ReviewLevel.HIGHER }),
      review({ level: ReviewLevel.HIGHER }),
      review({ level: ReviewLevel.LOWER }),
    ]);

    expect(reputationAlerts(lower)).toEqual(["Nivel por debajo de su categoría según el 67%"]);
    expect(reputationAlerts(higher)).toEqual(["Nivel por encima de su categoría según el 67%"]);
  });

  it("no marca alertas con menos de 3 reseñas", () => {
    expect(reputationAlerts(summarizeReputation([review({ onTime: false }), review({ onTime: false })]))).toEqual(
      [],
    );
  });
});

describe("isWithinReviewWindow", () => {
  const end = new Date(2026, 9, 12, 21, 0);

  it("permite calificar desde que termina el partido hasta 48 horas después", () => {
    expect(isWithinReviewWindow(end, end)).toBe(true);
    expect(isWithinReviewWindow(end, new Date(2026, 9, 14, 20, 59))).toBe(true);
    expect(isWithinReviewWindow(end, new Date(2026, 9, 14, 21, 1))).toBe(false);
  });

  it("no permite calificar antes de que termine el partido", () => {
    expect(isWithinReviewWindow(end, new Date(2026, 9, 12, 20, 0))).toBe(false);
  });
});

describe("canReviewMatch", () => {
  const start = new Date(2026, 9, 12, 19, 30);
  const match = {
    fromDateTime: start,
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    attendedPlayerIds: [1, 2],
  };
  const afterEnd = new Date(2026, 9, 12, 22, 0);

  it("permite calificar un partido terminado hace menos de 48 h, si el jugador y algún compañero asistieron", () => {
    expect(canReviewMatch(match, 1, afterEnd)).toBe(true);
  });

  it("no lo permite si el jugador no asistió o si no tuvo compañeros que asistieran", () => {
    expect(canReviewMatch(match, 3, afterEnd)).toBe(false);
    expect(canReviewMatch({ ...match, attendedPlayerIds: [1] }, 1, afterEnd)).toBe(false);
  });

  it("no lo permite en un partido cancelado, que no terminó o de hace más de 48 h", () => {
    expect(canReviewMatch({ ...match, bookingState: BookingState.CANCELLED }, 1, afterEnd)).toBe(false);
    expect(canReviewMatch(match, 1, new Date(2026, 9, 12, 20, 0))).toBe(false);
    expect(canReviewMatch(match, 1, new Date(2026, 9, 15, 0, 0))).toBe(false);
  });
});

describe("negativeReviewPoints", () => {
  it("una reseña sin aspectos negativos no descuenta puntos", () => {
    expect(negativeReviewPoints(review())).toBe(0);
  });

  it("descuenta por la mala actitud, por llegar tarde o por un nivel distinto a la categoría declarada", () => {
    expect(negativeReviewPoints(review({ goodAttitude: false }))).toBe(NEGATIVE_REVIEW_POINTS);
    expect(negativeReviewPoints(review({ onTime: false }))).toBe(NEGATIVE_REVIEW_POINTS);
    expect(negativeReviewPoints(review({ level: ReviewLevel.LOWER }))).toBe(NEGATIVE_REVIEW_POINTS);
    expect(negativeReviewPoints(review({ level: ReviewLevel.HIGHER }))).toBe(NEGATIVE_REVIEW_POINTS);
  });

  it("cada aspecto negativo descuenta por separado", () => {
    expect(negativeReviewPoints(review({ goodAttitude: false, onTime: false }))).toBe(2 * NEGATIVE_REVIEW_POINTS);
    expect(
      negativeReviewPoints(review({ goodAttitude: false, onTime: false, level: ReviewLevel.LOWER })),
    ).toBe(3 * NEGATIVE_REVIEW_POINTS);
  });
});
