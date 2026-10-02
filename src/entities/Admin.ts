import "reflect-metadata";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import type { Account } from "@/src/entities/Account";

@Entity({ name: "admins" })
export class Admin {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne("Account", "admin", { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  @Column({ type: "int", nullable: true })
  dni!: number | null;

  @Column({ type: "varchar" })
  names!: string;

  @Column({ type: "varchar", name: "last_names" })
  lastnames!: string;
}
