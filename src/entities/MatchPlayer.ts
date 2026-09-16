import "reflect-metadata";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";

/**
 * Un jugador sumado a un partido abierto. playersCount cuenta al jugador que
 * se anota más los acompañantes que trae consigo sin cuenta propia (solo
 * aplica a quien crea el partido); quien se suma después siempre ocupa 1 lugar.
 */
@Entity({ name: "match_players" })
export class MatchPlayer {
  @PrimaryColumn({ name: "match_id" })
  matchId!: number;

  @PrimaryColumn({ name: "player_id" })
  playerId!: number;

  @ManyToOne("Match", "matchPlayers", { onDelete: "CASCADE" })
  @JoinColumn({ name: "match_id" })
  match!: Match;

  @ManyToOne("Player", "matchParticipations", { onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @Column({ type: "int", default: 1, name: "players_count" })
  playersCount!: number;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}
