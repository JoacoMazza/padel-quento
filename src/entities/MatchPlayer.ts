import "reflect-metadata";
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";

/** Un jugador sumado a un partido abierto: cada fila ocupa exactamente un lugar. */
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
}
