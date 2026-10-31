import "reflect-metadata";
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Player } from "@/src/entities/Player";

/**
 * Rol de profesor de un jugador (HU-42): da clases en el complejo y sigue
 * siendo jugador. El administrador lo puede desactivar o quitarle el rol.
 */
@Entity({ name: "teachers" })
export class Teacher {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Player", "teacher", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;
}
