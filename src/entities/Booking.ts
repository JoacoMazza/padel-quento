import "reflect-metadata";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import type { Player } from "@/src/entities/Player";
import type { Court } from "@/src/entities/Court";

@Entity({ name: "bookings" })
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "timestamp" })
  fromDateTime!: Date;


  @Column({ type: "int", default: 90 })
  durationMinutes!: number;

  @Column({ type: "enum", enum: BookingState })
  bookingState!: BookingState;

  @ManyToOne("Player", (player: any) => player.bookings)
  player!: Player;

  @ManyToOne("Court", (court: any) => court.bookings)
  court!: Court;
}
