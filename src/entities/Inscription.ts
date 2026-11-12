import "reflect-metadata";
import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { Lesson } from "@/src/entities/Lesson";
import type { Player } from "@/src/entities/Player";

/** Alumno (un jugador) inscripto en una clase: va a todos sus turnos. */
@Entity({ name: "inscriptions" })
@Unique("UQ_inscriptions_lesson_player", ["lesson", "player"])
export class Inscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Lesson", "inscriptions", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "lesson_id", foreignKeyConstraintName: "FK_inscriptions_lesson_id" })
  lesson!: Lesson;

  @ManyToOne("Player", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id", foreignKeyConstraintName: "FK_inscriptions_player_id" })
  player!: Player;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;
}
