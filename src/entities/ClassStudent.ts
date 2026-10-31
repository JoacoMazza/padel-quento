import "reflect-metadata";
import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Player } from "@/src/entities/Player";

/** Alumno (un jugador) registrado por el profesor en un turno de clase (HU-44). */
@Entity({ name: "class_students" })
@Unique("UQ_class_students_booking_player", ["booking", "player"])
export class ClassStudent {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Booking", "classStudents", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @ManyToOne("Player", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;
}
