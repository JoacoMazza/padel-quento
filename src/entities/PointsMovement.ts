import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { Player } from "@/src/entities/Player";

export enum PointsMovementType {
  BONUS = "bonus",
  PENALTY = "penalty",
}

@Entity({ name: "points_movements" })
export class PointsMovement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  playerId!: number;

  @ManyToOne("Player", "movements", { onDelete: "CASCADE" })
  player!: Player;

  /** Positive for bonus, negative for penalty */
  @Column({ type: "float" })
  amount!: number;

  @Column({ type: "varchar", default: PointsMovementType.BONUS })
  type!: PointsMovementType;

  @Column({ type: "varchar" })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
