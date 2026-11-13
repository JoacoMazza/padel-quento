import "reflect-metadata";
import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Inscription } from "@/src/entities/Inscription";
import type { LessonSchedule } from "@/src/entities/LessonSchedule";
import type { Player } from "@/src/entities/Player";

/**
 * Clase que el admin da de alta asignando a un jugador registrado como
 * profesor: define el cupo, el precio, las fechas y los horarios semanales
 * (LessonSchedule). Cada fecha de esos horarios es un turno (Booking) a nombre
 * del profesor. Ser profesor es un rol del jugador: tener una clase activa.
 */
@Entity({ name: "lessons" })
@Check("CHK_lessons_class_capacity", `"class_capacity" BETWEEN 1 AND 8`)
export class Lesson {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Player", "lessons", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id", foreignKeyConstraintName: "FK_lessons_teacher_id" })
  teacher!: Player;

  @Column({ type: "int", name: "class_capacity" })
  classCapacity!: number;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;

  /** Inicio del primer día de la clase, en hora de pared del club. */
  @Column({ type: "timestamp", name: "from_local_datetime" })
  fromLocalDatetime!: Date;

  /** Fin del último día de la clase, en hora de pared del club; null si no tiene fecha de fin. */
  @Column({ type: "timestamp", name: "to_local_datetime", nullable: true })
  toLocalDatetime!: Date | null;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => (typeof value === "string" ? parseFloat(value) : value),
    },
  })
  price!: number;

  @OneToMany("LessonSchedule", "lesson")
  schedules!: LessonSchedule[];

  @OneToMany("Inscription", "lesson")
  inscriptions!: Inscription[];

  @OneToMany("Booking", "lesson")
  bookings!: Booking[];
}
