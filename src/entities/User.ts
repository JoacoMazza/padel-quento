import "reflect-metadata";
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
} from "typeorm";
import { Role } from "@/src/domain/enums";

@Entity({ name: "users" })
@TableInheritance({ column: { type: "varchar", name: "type" } })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: true })
  dni!: number | null;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar" })
  names!: string;

  @Column({ type: "varchar", name: "last_names" })
  lastnames!: string;

  @Column({ type: "varchar", nullable: true, name: "phone_number" })
  phoneNumber!: string | null;

  @Column({ type: "varchar", default: Role.PLAYER })
  role!: Role;

  @Column({ type: "varchar", nullable: true, name: "photo_url" })
  photoUrl!: string | null;

  /** Hash bcrypt; nunca se envía al cliente. RNF-03. */
  @Column({ type: "varchar", name: "password_hashed" })
  passwordHash!: string;
}
