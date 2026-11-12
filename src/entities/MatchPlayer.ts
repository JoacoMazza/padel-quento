import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from "typeorm";
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";

/**
 * Un jugador sumado a un partido abierto. playersCount cuenta al jugador que
 * se anota más los acompañantes que trae consigo sin cuenta propia (aplica
 * tanto a quien crea el partido como a quien se suma después).
 *
 * Usa id autogenerado en vez de clave primaria compuesta (match_id, player_id):
 * con TypeORM, guardar filas nuevas mediante una PK compuesta armada a partir
 * de relaciones puede terminar pisando una fila existente en vez de insertar
 * una nueva, porque save() no siempre distingue bien "insert" de "update" en
 * ese caso. La combinación sigue siendo única gracias al @Unique de abajo.
 */
@Entity({ name: "match_players" })
@Unique("UQ_match_players_match_player", ["match", "player"])
export class MatchPlayer {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Match", "matchPlayers", { onDelete: "CASCADE" })
  @JoinColumn({ name: "match_id", foreignKeyConstraintName: "FK_match_players_match_id" })
  match!: Match;

  @ManyToOne("Player", "matchParticipations", { onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id", foreignKeyConstraintName: "FK_match_players_player_id" })
  player!: Player;

  @RelationId((matchPlayer: MatchPlayer) => matchPlayer.player)
  playerId!: number;

  @Column({ type: "int", default: 1, name: "players_count" })
  playersCount!: number;

  /**
   * Cuántos de su grupo (playersCount) asistieron. Arranca en playersCount: el
   * administrador solo interviene desde la turnera global para marcar ausentes,
   * y cada ausente penaliza a este jugador (ver src/actions/attendance.ts).
   */
  @Column({ type: "int", default: 1, name: "attended_count" })
  attendedCount!: number;

  /** Puntos que el job de asistencia le acreditó por este partido. */
  @Column({ type: "int", default: 0, name: "points_awarded" })
  pointsAwarded!: number;

  @CreateDateColumn({ name: "joined_at" })
  joinedAt!: Date;
}
