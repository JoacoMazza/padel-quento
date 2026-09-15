import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import type { Player } from "@/src/entities/Player";
import type { Court } from "@/src/entities/Court";
import type { BookingParticipant } from "@/src/entities/BookingParticipant";

@Entity({ name: "bookings" })
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "timestamp", name: "datetime" })
  fromDateTime!: Date;

  @Column({ type: "int", default: 90, name: "duration_minutes" })
  durationMinutes!: number;

  @Column({ type: "enum", enum: BookingState, name: "booking_state" })
  bookingState!: BookingState;

  @ManyToOne("Player", (player: any) => player.bookings)
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @ManyToOne("Court", (court: any) => court.bookings)
  @JoinColumn({ name: "court_id" })
  court!: Court;

  /** Jugadores confirmados; usado por los partidos abiertos para saber cuántos lugares faltan. */
  @OneToMany("BookingParticipant", "booking")
  participants!: BookingParticipant[];
}
