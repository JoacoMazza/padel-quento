import "reflect-metadata";
import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Account } from "@/src/entities/Account";
import { AdminAccessLevel } from "@/src/domain/enums";

@Entity({ name: "admins" })
@Index("UQ_admins_dni", ["dni"], { unique: true })
export class Admin {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Account", "admin", { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  /**
   * Obligatorio al crear o editar (ver src/actions/admin.ts). La columna sigue
   * aceptando NULL por los administradores anteriores; Postgres no considera
   * repetidos los NULL, así que UQ_admins_dni solo impide repetir DNI cargados.
   */
  @Column({ type: "int", nullable: true })
  dni!: number | null;

  @Column({ type: "varchar" })
  names!: string;

  @Column({ type: "varchar", name: "last_names" })
  lastnames!: string;

  /** Dueño o trabajador (ver requireOwner en src/lib/rbac.ts). */
  @Column({ type: "enum", enum: AdminAccessLevel, name: "access_level", default: AdminAccessLevel.STAFF })
  accessLevel!: AdminAccessLevel;
}
