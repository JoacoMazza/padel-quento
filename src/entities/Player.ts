import "reflect-metadata";
import { ChildEntity, Column, JoinColumn, OneToMany, OneToOne } from "typeorm";
import { PlayerCategory } from "@/src/domain/enums";
import { Booker } from "@/src/entities/Booker";
import type { Account } from "@/src/entities/Account";
import type { Penalty } from "@/src/entities/Penalty";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";

/**
 * Jugador registrado en la plataforma: es un Booker (hereda nombre, apellido y
 * teléfono, y se guarda en "bookers") con una cuenta (Account) que guarda sus
 * credenciales.
 */
@ChildEntity()
export class Player extends Booker {
  @OneToOne("Account", "player", { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

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
