import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import type { Booker } from "@/src/entities/Booker";
import type { Court } from "@/src/entities/Court";
import type { Match } from "@/src/entities/Match";
import type { Lesson } from "@/src/entities/Lesson";
import type { Penalty } from "@/src/entities/Penalty";

@Entity({ name: "bookings" })
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "timestamp", name: "datetime" })
  fromDateTime!: Date;

  @Column({ type: "int", default: 90, name: "duration_minutes" })
  durationMinutes!: number;

  @Column({ type: "enum", enum: BookingState, name: "booking_state" })
  bookingState!: BookingState;

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

  /** Quien reservó el turno (bookings.booker_id -> bookers.id). */
  @ManyToOne("Booker", "bookings")
  @JoinColumn({ name: "booker_id", foreignKeyConstraintName: "FK_bookings_booker_id" })
  booker!: Booker;

  @ManyToOne("Court", "bookings")
  @JoinColumn({ name: "court_id" })
  court!: Court;

  /** Partido asociado si el turno se reservó como partido abierto. */
  @OneToOne("Match", "booking")
  match?: Match;

  @Column({ type: "boolean", default: false, name: "is_paid" })
  isPaid!: boolean;

  /**
   * Movimientos de puntos que originó el turno: la asistencia que acreditó el
   * job y las inasistencias que marcó el administrador (ver
   * src/actions/attendance.ts). En un turno sin partido abierto, quien
   * reservó asistió salvo que tenga una inasistencia (ver bookerAttended).
   */
  @OneToMany("Penalty", "booking")
  penalties?: Penalty[];

  /**
   * Clase a la que pertenece el turno, si es uno de sus horarios: lo reservó
   * el profesor y lo toman los alumnos inscriptos en la clase. Null en
   * cualquier otro turno.
   */
  @ManyToOne("Lesson", "bookings", { nullable: true })
  @JoinColumn({ name: "lesson_id", foreignKeyConstraintName: "FK_bookings_lesson_id" })
  lesson!: Lesson | null;
}
