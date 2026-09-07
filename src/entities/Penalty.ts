import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Player } from "@/src/entities/Player";

@Entity({ name: "penalties" })
export class Penalty {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", name: "player_id" })
  playerId!: number;

  @ManyToOne("Player", "penalties", { onDelete: "CASCADE" })
  player!: Player;

  /** Puntos penalizados o bonificados (negativo para penalizaciones, positivo para bonificaciones) */
  @Column({ type: "float", name: "penalized_scoring" })
  penalizedScoring!: number;

  @Column({ type: "varchar" })
  reason!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

