import "reflect-metadata";
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

/**
 * Un partido abierto: se crea junto con la reserva que ocupa la cancha y agrupa
 * a los jugadores (match_players) hasta completar el cupo, momento en el que
 * needsPlayers pasa a false.
 */
@Entity({ name: "matches" })
export class Match {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Booking", "match")
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "boolean", default: true, name: "need_players" })
  needsPlayers!: boolean;

  @OneToMany("MatchPlayer", "match")
  matchPlayers!: MatchPlayer[];
}
