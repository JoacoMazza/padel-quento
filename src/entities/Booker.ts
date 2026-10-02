import "reflect-metadata";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn, TableInheritance, Unique } from "typeorm";
import type { Booking } from "@/src/entities/Booking";

/**
 * Persona que reserva turnos, identificada por su teléfono. Los turnos la
 * referencian por phone_number (ver Booking.booker). Player hereda de Booker
 * (un jugador es un booker con cuenta); como TypeORM solo soporta herencia en
 * una única tabla, ambos se guardan en "bookers" y la columna "type" los
 * distingue. Solo puede reservar un booker que sea jugador registrado.
 */
@Entity({ name: "bookers" })
@TableInheritance({ column: { type: "varchar", name: "type" } })
@Unique("UQ_bookers_phone_number", ["phoneNumber"])
export class Booker {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar" })
  names!: string;

  @Column({ type: "varchar", name: "last_names" })
  lastnames!: string;

  @Column({ type: "varchar", name: "phone_number" })
  phoneNumber!: string;

  @OneToMany("Booking", "booker")
  bookings!: Booking[];
}
