import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from "typeorm";
import type { Player } from "@/src/entities/Player";
import type { Booking } from "@/src/entities/Booking";

@Entity({ name: "penalties" })
export class Penalty {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Player", "penalties", { onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id", foreignKeyConstraintName: "FK_penalties_player_id" })
  player!: Player;

  /** Puntos penalizados o bonificados (negativo para penalizaciones, positivo para bonificaciones) */
  @Column({ type: "float", name: "penalized_scoring" })
  penalizedScoring!: number;

  @Column({ type: "varchar" })
  reason!: string;

  /** Turno que originó el movimiento (asistencia o inasistencia), si lo originó uno. */
  @ManyToOne("Booking", "penalties", { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "booking_id", foreignKeyConstraintName: "FK_penalties_booking_id" })
  booking?: Booking | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

