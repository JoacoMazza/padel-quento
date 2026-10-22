import "reflect-metadata";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { ReviewLevel } from "@/src/domain/enums";
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";

/**
 * Reseña que deja un jugador sobre un compañero después de un partido abierto
 * (HU-36). De las reseñas sale la reputación del jugador, en porcentajes. Una
 * reseña negativa (mala actitud, llegar tarde o nivel distinto a su categoría)
 * además le descuenta puntos de fidelidad al reseñado (issue #73, ver
 * negativeReviewPoints).
 */
@Entity({ name: "player_reviews" })
@Unique("UQ_player_reviews_match_reviewer_reviewed", ["match", "reviewer", "reviewed"])
export class PlayerReview {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Match", { onDelete: "CASCADE" })
  @JoinColumn({ name: "match_id" })
  match!: Match;

  @ManyToOne("Player", { onDelete: "CASCADE" })
  @JoinColumn({ name: "reviewer_id" })
  reviewer!: Player;

  @ManyToOne("Player", { onDelete: "CASCADE" })
  @JoinColumn({ name: "reviewed_id" })
  reviewed!: Player;

  @Column({ type: "enum", enum: ReviewLevel })
  level!: ReviewLevel;

  @Column({ type: "boolean", name: "good_attitude" })
  goodAttitude!: boolean;

  @Column({ type: "boolean", name: "on_time" })
  onTime!: boolean;

  @Column({ type: "text", nullable: true })
  comment!: string | null;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;
}
