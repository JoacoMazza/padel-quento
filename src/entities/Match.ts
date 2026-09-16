import "reflect-metadata";
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

/**
 * Partido asociado a un turno reservado como partido abierto. Se modela aparte
 * de Booking (ver docs/der): el turno es la reserva de la cancha en sí, y el
 * partido es la convocatoria de jugadores para ese turno.
 */
@Entity({ name: "matchs" })
export class Match {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Booking", { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "boolean", name: "need_players", default: true })
  needPlayers!: boolean;

  @OneToMany("MatchPlayer", "match")
  players!: MatchPlayer[];
}
