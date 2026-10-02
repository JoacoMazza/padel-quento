import "reflect-metadata";
import { Column, Entity, OneToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { Admin } from "@/src/entities/Admin";
import type { Player } from "@/src/entities/Player";

/**
 * Credenciales de acceso a la plataforma web. Cada cuenta pertenece a un
 * administrador (Admin) o a un jugador (Player); el rol de la sesión se
 * deduce de cuál de los dos tiene asociado (ver src/lib/auth.ts).
 */
@Entity({ name: "accounts" })
@Unique("UQ_accounts_email", ["email"])
export class Account {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  email!: string;

  @Column({ type: "varchar", nullable: true, name: "photo_url" })
  photoUrl!: string | null;

  /** Hash bcrypt; nunca se envía al cliente. RNF-03. */
  @Column({ type: "varchar", name: "password_hashed" })
  passwordHash!: string;

  /** Si es true, la cuenta no puede iniciar sesión ni realizar reservas. */
  @Column({ type: "boolean", default: false, name: "is_blocked" })
  isBlocked!: boolean;

  @OneToOne("Admin", "account")
  admin?: Admin | null;

  @OneToOne("Player", "account")
  player?: Player | null;
}
