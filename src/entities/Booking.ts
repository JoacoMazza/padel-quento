import "reflect-metadata";
import { Check, Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import type { Booker } from "@/src/entities/Booker";
import type { Court } from "@/src/entities/Court";
import type { Match } from "@/src/entities/Match";
import type { ClassStudent } from "@/src/entities/ClassStudent";

@Entity({ name: "bookings" })
@Check("CHK_bookings_class_capacity", `"class_capacity" BETWEEN 1 AND 8`)
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

  /**
   * Quien reservó el turno, referenciado por su teléfono como en el DER
   * (bookings.booker_phone_number -> bookers.phone_number).
   */
  @ManyToOne("Booker", "bookings", { onUpdate: "CASCADE" })
  @JoinColumn({ name: "booker_phone_number", foreignKeyConstraintName: "FK_bookings_booker_phone_number", referencedColumnName: "phoneNumber" })
  booker!: Booker;

  @ManyToOne("Court", (court: any) => court.bookings)
  @JoinColumn({ name: "court_id" })
  court!: Court;

  /** Partido asociado si el turno se reservó como partido abierto. */
  @OneToOne("Match", "booking")
  match?: Match;

  /**
   * Asistencia de quien reservó el turno. Solo aplica cuando el turno
   * NO tiene un partido abierto asociado (ver MatchPlayer.attended para ese caso).
   * Arranca en true: el administrador solo interviene para marcar la ausencia.
   */
  @Column({ type: "boolean", default: true, name: "attended" })
  attended!: boolean;

  /**
   * true una vez que el job de puntos por asistencia (ver
   * src/jobs/attendance-points.ts) ya procesó este turno, para no acreditar
   * los puntos dos veces.
   */
  @Column({ type: "boolean", default: false, name: "points_awarded" })
  pointsAwarded!: boolean;

  /**
   * Cupo de alumnos si el turno es una clase (HU-43): la reserva de un profesor
   * (quien reservó) para dar clase. Null en cualquier otro turno.
   */
  @Column({ type: "int", nullable: true, name: "class_capacity" })
  classCapacity!: number | null;

  /** Alumnos registrados en la clase (HU-44). */
  @OneToMany("ClassStudent", "booking")
  classStudents!: ClassStudent[];
}
