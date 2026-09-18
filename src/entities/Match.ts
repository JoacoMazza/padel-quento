import "reflect-metadata";
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Chat } from "@/src/entities/Chat";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

/**
 * Partido asociado a un turno reservado como partido abierto (ver docs/der):
 * el turno reserva la cancha, y el partido agrupa a los jugadores confirmados
 * (match_players) hasta completar el cupo, momento en el que needPlayers pasa
 * a false (también se puede cerrar manualmente antes de completar el cupo).
 */
@Entity({ name: "matchs" })
export class Match {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Booking", "match")
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "boolean", default: true, name: "need_players" })
  needPlayers!: boolean;

  @OneToMany("MatchPlayer", "match")
  matchPlayers!: MatchPlayer[];

  /** Sala de chat temporal del partido, si ya se sumó un segundo jugador con cuenta. */
  @OneToOne("Chat", "match")
  chat?: Chat;
}
