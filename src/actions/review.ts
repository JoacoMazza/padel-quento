"use server";

import "reflect-metadata";
import type { Match } from "@/src/entities/Match";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";
import type { PlayerReview } from "@/src/entities/PlayerReview";
import { BookingState, ReviewLevel, type PlayerCategory } from "@/src/domain/enums";
import { REVIEW_COMMENT_MAX_LENGTH } from "@/src/domain/constants";
import { isWithinReviewWindow } from "@/src/domain/reputation";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import type { ActionResult } from "@/src/lib/action-result";
import { getSessionPlayerId } from "@/src/lib/session-player";

export type ReviewableTeammate = {
  playerId: number;
  name: string;
  category: PlayerCategory;
  alreadyReviewed: boolean;
};

export type SubmitPlayerReviewInput = {
  matchId: number;
  reviewedPlayerId: number;
  level: ReviewLevel;
  goodAttitude: boolean;
  onTime: boolean;
  comment?: string | null;
};

const LOGIN_REQUIRED_MESSAGE = "Tenés que iniciar sesión para calificar.";
const NOT_A_PLAYER_MESSAGE = "Solo podés calificar a compañeros de un partido que jugaste.";
const NOT_REVIEWABLE_MESSAGE = "Este partido no se puede calificar.";

/** Error de validación cuyo mensaje se muestra tal cual al jugador. */
class ReviewError extends Error {}

/**
 * Partido que el jugador de la sesión puede calificar: no cancelado, terminado
 * hace menos de 48 horas y en el que el jugador asistió. Devuelve a los que
 * asistieron, para elegir a quién calificar.
 */
async function loadReviewableMatch(matchId: number, playerId: number) {
  const dataSource = await getDataSource();
  const match = await dataSource.getRepository<Match>("Match").findOne({
    where: { id: matchId },
    relations: { booking: true, matchPlayers: { player: true } },
  });
  if (!match || match.booking.bookingState === BookingState.CANCELLED) {
    throw new ReviewError(NOT_REVIEWABLE_MESSAGE);
  }

  const attended = match.matchPlayers.filter((mp: MatchPlayer) => mp.attended);
  if (!attended.some((mp) => mp.player.id === playerId)) {
    throw new ReviewError(NOT_A_PLAYER_MESSAGE);
  }

  const end = new Date(new Date(match.booking.fromDateTime).getTime() + match.booking.durationMinutes * 60_000);
  if (new Date() < end) throw new ReviewError("El partido todavía no terminó.");
  if (!isWithinReviewWindow(end)) throw new ReviewError("Ya pasaron las 48 horas para calificar este partido.");

  return attended;
}

/** Compañeros del partido que el jugador de la sesión puede calificar, y si ya lo hizo (HU-36). */
export async function getReviewableTeammates(matchId: number): Promise<ActionResult<ReviewableTeammate[]>> {
  try {
    const playerId = await getSessionPlayerId();
    if (playerId === null) return { success: false, error: LOGIN_REQUIRED_MESSAGE };

    const attended = await loadReviewableMatch(matchId, playerId);
    const dataSource = await getDataSource();
    const done = await dataSource.getRepository<PlayerReview>("PlayerReview").find({
      where: { match: { id: matchId }, reviewer: { id: playerId } },
      relations: { reviewed: true },
    });
    const reviewedIds = new Set(done.map((review) => review.reviewed.id));

    return {
      success: true,
      data: attended
        .filter((mp) => mp.player.id !== playerId)
        .map((mp) => ({
          playerId: mp.player.id,
          name: `${mp.player.names} ${mp.player.lastnames}`,
          category: mp.player.category,
          alreadyReviewed: reviewedIds.has(mp.player.id),
        })),
    };
  } catch (error) {
    if (error instanceof ReviewError) return { success: false, error: error.message };
    console.error("getReviewableTeammates", error);
    return { success: false, error: "No se pudieron obtener los compañeros del partido." };
  }
}

/** Guarda la reseña del jugador de la sesión sobre un compañero del partido (HU-36). */
export async function submitPlayerReview(input: SubmitPlayerReviewInput): Promise<ActionResult<null>> {
  try {
    const playerId = await getSessionPlayerId();
    if (playerId === null) return { success: false, error: LOGIN_REQUIRED_MESSAGE };

    if (input.reviewedPlayerId === playerId) throw new ReviewError("No podés calificarte a vos mismo.");
    const comment = input.comment?.trim() || null;
    if (comment && comment.length > REVIEW_COMMENT_MAX_LENGTH) {
      throw new ReviewError(`El comentario puede tener hasta ${REVIEW_COMMENT_MAX_LENGTH} caracteres.`);
    }
    if (!Object.values(ReviewLevel).includes(input.level)) throw new ReviewError(NOT_REVIEWABLE_MESSAGE);

    const attended = await loadReviewableMatch(input.matchId, playerId);
    if (!attended.some((mp) => mp.player.id === input.reviewedPlayerId)) {
      throw new ReviewError("Solo podés calificar a compañeros que jugaron el partido.");
    }

    const dataSource = await getDataSource();
    const reviews = dataSource.getRepository<PlayerReview>("PlayerReview");
    await reviews.save(
      reviews.create({
        match: { id: input.matchId },
        reviewer: { id: playerId },
        reviewed: { id: input.reviewedPlayerId },
        level: input.level,
        goodAttitude: input.goodAttitude,
        onTime: input.onTime,
        comment,
      }),
    );
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof ReviewError) return { success: false, error: error.message };
    if (isUniqueViolation(error)) return { success: false, error: "Ya calificaste a este jugador en este partido." };
    console.error("submitPlayerReview", error);
    return { success: false, error: "No se pudo guardar la calificación." };
  }
}
