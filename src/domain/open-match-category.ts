import { PlayerCategory } from "@/src/domain/enums";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";

export type OpenMatchCategoryProblem =
  | { kind: "missing_category" }
  | { kind: "category_mismatch"; category: PlayerCategory };

/**
 * Los partidos abiertos se arman por categoría (issue #54): solo se suman
 * jugadores con la misma categoría actual que quien creó el partido. Un
 * jugador sin categoría tiene que cargarla primero. Un partido creado antes de
 * esta validación, por alguien sin categoría, queda abierto a cualquiera.
 */
export function openMatchCategoryProblem(
  creatorCategory: PlayerCategory | undefined,
  playerCategory: PlayerCategory,
): OpenMatchCategoryProblem | null {
  if (playerCategory === PlayerCategory.WITHOUT_CATEGORY) {
    return { kind: "missing_category" };
  }
  if (creatorCategory && creatorCategory !== PlayerCategory.WITHOUT_CATEGORY && playerCategory !== creatorCategory) {
    return { kind: "category_mismatch", category: creatorCategory };
  }
  return null;
}

export function categoryMismatchMessage(category: PlayerCategory): string {
  return `Este partido es para jugadores de ${PLAYER_CATEGORY_LABELS[category]}.`;
}
