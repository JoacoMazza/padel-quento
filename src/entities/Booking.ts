import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import type { Player } from "@/src/entities/Player";
import type { Court } from "@/src/entities/Court";
import type { Match } from "@/src/entities/Match";

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

  @ManyToOne("Player", (player: any) => player.bookings)
  @JoinColumn({ name: "player_id" })
  player!: Player;

  @ManyToOne("Court", (court: any) => court.bookings)
  @JoinColumn({ name: "court_id" })
  court!: Court;

  /** Partido asociado si el turno se reservó como partido abierto. */
  @OneToOne("Match", "booking")
  match?: Match;
}
