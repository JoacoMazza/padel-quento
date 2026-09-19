import { PlayerCategory } from "@/src/domain/enums";

/** Texto con el que se muestra cada categoría de jugador en la UI. */
export const PLAYER_CATEGORY_LABELS: Record<PlayerCategory, string> = {
  [PlayerCategory.FIRST]: "1ª Categoría",
  [PlayerCategory.SECOND]: "2ª Categoría",
  [PlayerCategory.THIRD]: "3ª Categoría",
  [PlayerCategory.FOURTH]: "4ª Categoría",
  [PlayerCategory.FIFTH]: "5ª Categoría",
  [PlayerCategory.SIXTH]: "6ª Categoría",
  [PlayerCategory.SEVENTH]: "7ª Categoría",
  [PlayerCategory.WITHOUT_CATEGORY]: "Sin categoría",
};
