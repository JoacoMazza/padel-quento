import "reflect-metadata";
import { Column, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Player } from "@/src/entities/Player";

/**
 * Persona que reserva turnos, identificada por su teléfono. Los turnos la
 * referencian por phone_number (ver Booking.booker). Solo puede reservar si
 * pertenece a un jugador registrado (Player.booker): sin cuenta no puede hacer nada.
 */
@Entity({ name: "bookers" })
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

  /** Jugador con cuenta asociado, si quien reserva está registrado en la plataforma. */
  @OneToOne("Player", "booker")
  player?: Player | null;
}
