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
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";

/**
 * Un jugador confirmado dentro de un partido abierto. playersCount cuenta al
 * jugador que se anota más los acompañantes que trae consigo (no tienen cuenta
 * propia), para saber cuántos de los 4 lugares ocupa.
 */
@Entity({ name: "match_players" })
@Unique(["match", "player"])
export class MatchPlayer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Match", "players", { onDelete: "CASCADE" })
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
