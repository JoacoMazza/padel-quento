import "reflect-metadata";
import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { PlayerCategory } from "@/src/domain/enums";
import type { Account } from "@/src/entities/Account";
import type { Booker } from "@/src/entities/Booker";
import type { Penalty } from "@/src/entities/Penalty";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

/**
 * Jugador registrado en la plataforma: su cuenta (Account) guarda las
 * credenciales y su Booker los datos personales con los que reserva turnos.
 */
@Entity({ name: "players" })
export class Player {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Account", "player", { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @OneToOne("Booker", "player")
  @JoinColumn({ name: "booker_id" })
  booker!: Booker;

  @Column({
    type: "varchar",
    default: PlayerCategory.WITHOUT_CATEGORY,
  })
  category!: PlayerCategory;

  @Column({ type: "float", default: 0 })
  scoring!: number;

  @OneToMany("Penalty", "player")
  penalties!: Penalty[];
  @OneToMany("MatchPlayer", "player")
  matchParticipations!: MatchPlayer[];
}
