import "reflect-metadata";
import { In } from "typeorm";
import type { PlayerReview } from "@/src/entities/PlayerReview";
import type { ReviewLevel } from "@/src/domain/enums";
import { summarizeReputation, type ReputationSummary } from "@/src/domain/reputation";
import { getDataSource } from "@/src/lib/db";

/** Reputación de cada jugador indicado (HU-36); quien no tiene reseñas queda con 0. */
export async function getReputations(playerIds: number[]): Promise<Map<number, ReputationSummary>> {
  const reputations = new Map<number, ReputationSummary>();
  if (playerIds.length === 0) return reputations;

  const dataSource = await getDataSource();
  const reviews = await dataSource.getRepository<PlayerReview>("PlayerReview").find({
    where: { reviewed: { id: In(playerIds) } },
    relations: { reviewed: true },
  });
  for (const playerId of playerIds) {
    reputations.set(playerId, summarizeReputation(reviews.filter((r) => r.reviewed.id === playerId)));
  }
  return reputations;
}

export type ReviewForAdmin = {
  id: number;
  reviewerName: string;
  createdAt: string;
  level: ReviewLevel;
  goodAttitude: boolean;
  onTime: boolean;
  comment: string | null;
};

/** Reseñas recibidas por un jugador, de la más nueva a la más vieja, con quién la dejó (solo para el admin). */
export async function getReviewsOf(playerId: number): Promise<ReviewForAdmin[]> {
  const dataSource = await getDataSource();
  const reviews = await dataSource.getRepository<PlayerReview>("PlayerReview").find({
    where: { reviewed: { id: playerId } },
    relations: { reviewer: true },
    order: { createdAt: "DESC" },
  });
  return reviews.map((review) => ({
    id: review.id,
    reviewerName: `${review.reviewer.names} ${review.reviewer.lastnames}`,
    createdAt: new Date(review.createdAt).toISOString(),
    level: review.level,
    goodAttitude: review.goodAttitude,
    onTime: review.onTime,
    comment: review.comment,
  }));
}
