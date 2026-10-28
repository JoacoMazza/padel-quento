import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { FixedBookingFrequency } from "@/src/domain/enums";
import type { Booker } from "@/src/entities/Booker";
import type { Court } from "@/src/entities/Court";
import type { FixedBookingDate } from "@/src/entities/FixedBookingDate";

/**
 * Turno fijo (HU-41): una cancha reservada para el mismo titular todas las
 * semanas o cada dos semanas, a la misma hora. El día de la semana es el de
 * `startDate`. Sus fechas se reservan como turnos comunes (ver FixedBookingDate).
 */
@Entity({ name: "fixed_bookings" })
export class FixedBooking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Court")
  @JoinColumn({ name: "court_id", foreignKeyConstraintName: "FK_fixed_bookings_court_id" })
  court!: Court;

  // Igual que en Booking: quien reserva se identifica por su teléfono.
  @ManyToOne("Booker", { onUpdate: "CASCADE" })
  @JoinColumn({ name: "booker_phone_number", foreignKeyConstraintName: "FK_fixed_bookings_booker_phone_number", referencedColumnName: "phoneNumber" })
  booker!: Booker;

  @Column({ type: "date", name: "start_date" })
  startDate!: string;

  @Column({ type: "date", name: "end_date", nullable: true })
  endDate!: string | null;

  @Column({ type: "time", name: "start_time" })
  startTime!: string;

  @Column({ type: "int", default: 90, name: "duration_minutes" })
  durationMinutes!: number;

  @Column({ type: "enum", enum: FixedBookingFrequency })
  frequency!: FixedBookingFrequency;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt!: Date;

  @OneToMany("FixedBookingDate", "fixedBooking")
  dates!: FixedBookingDate[];
}
