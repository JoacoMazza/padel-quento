import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Player } from "@/src/entities/Player";

/**
 * Un jugador confirmado dentro de una reserva (usado por los partidos abiertos).
 * playersCount cuenta al jugador que se anota más los acompañantes que trae
 * consigo (no tienen cuenta propia), para saber cuántos de los 4 lugares ocupa.
 */
@Entity({ name: "booking_participants" })
@Unique(["booking", "player"])
export class BookingParticipant {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Booking", "participants", { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @ManyToOne("Player", "bookingParticipations", { onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @Column({ type: "int", default: 1, name: "players_count" })
  playersCount!: number;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}
