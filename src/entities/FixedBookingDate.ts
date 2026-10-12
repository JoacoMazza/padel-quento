import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { FixedBookingDateState } from "@/src/domain/enums";
import type { Booking } from "@/src/entities/Booking";
import type { FixedBooking } from "@/src/entities/FixedBooking";

/**
 * Cada fecha generada de un turno fijo, con el turno que se reservó para ella.
 * Registrar también las liberadas y las salteadas por estar ocupadas evita que
 * la extensión automática las vuelva a generar.
 */
@Entity({ name: "fixed_booking_dates" })
@Unique(["fixedBooking", "date"])
export class FixedBookingDate {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("FixedBooking", "dates", { onDelete: "CASCADE" })
  @JoinColumn({ name: "fixed_booking_id" })
  fixedBooking!: FixedBooking;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "enum", enum: FixedBookingDateState })
  state!: FixedBookingDateState;

  @OneToOne("Booking", { nullable: true })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking | null;
}
