import { describe, expect, it } from "vitest";
import { PlayerCategory } from "@/src/domain/enums";
import { categoryMismatchMessage, openMatchCategoryProblem } from "@/src/domain/open-match-category";

describe("openMatchCategoryProblem", () => {
  it("no hay problema si el jugador tiene la misma categoría que quien creó el partido", () => {
    expect(openMatchCategoryProblem(PlayerCategory.THIRD, PlayerCategory.THIRD)).toBeNull();
  });

  it("marca la categoría distinta, con la del partido", () => {
    expect(openMatchCategoryProblem(PlayerCategory.THIRD, PlayerCategory.FIFTH)).toEqual({
      kind: "category_mismatch",
      category: PlayerCategory.THIRD,
    });
  });

  it("marca al jugador sin categoría, aunque el partido no tenga restricción", () => {
    expect(openMatchCategoryProblem(PlayerCategory.THIRD, PlayerCategory.WITHOUT_CATEGORY)).toEqual({
      kind: "missing_category",
    });
    expect(openMatchCategoryProblem(undefined, PlayerCategory.WITHOUT_CATEGORY)).toEqual({ kind: "missing_category" });
  });

  it("no restringe la categoría si quien creó el partido no tiene una (partidos previos a la validación)", () => {
    expect(openMatchCategoryProblem(PlayerCategory.WITHOUT_CATEGORY, PlayerCategory.FIFTH)).toBeNull();
    expect(openMatchCategoryProblem(undefined, PlayerCategory.FIFTH)).toBeNull();
  });
});

describe("categoryMismatchMessage", () => {
  it("nombra la categoría del partido", () => {
    expect(categoryMismatchMessage(PlayerCategory.THIRD)).toBe("Este partido es para jugadores de 3ª Categoría.");
  });
});
