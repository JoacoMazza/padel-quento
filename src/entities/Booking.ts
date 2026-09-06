import "reflect-metadata";
import { ChildEntity, Column, ManyToOne } from "typeorm";
import { BookingState } from "@/src/domain/enums";
import { Player, Court } from "@/src/entities";

@ChildEntity()
export class Booking {
  @Column({ type: "datetime" })
  fromDateTime!: Date;


  @Column({ type: "int", default: 90 })
  durationMinutes!: number;

  @Column({ type: "enum", enum: BookingState, length: 255 })
  bookingState!: BookingState;

  @ManyToOne(() => Player, (player) => player.bookings)
  player!: Player;

  @ManyToOne(() => Court, (court) => court.bookings)
  court!: Court;
}
