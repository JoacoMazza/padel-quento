import "reflect-metadata";
import { ChildEntity, Column, OneToMany } from "typeorm";
import { PlayerCategory } from "@/src/domain/enums";
import { User } from "@/src/entities/User";

@ChildEntity()
export class Player extends User {
  @Column({
    type: "varchar",
    default: PlayerCategory.WITHOUT_CATEGORY,
  })
  category!: PlayerCategory;

  @Column({ type: "float", default: 0 })
  scoring!: number;

  @OneToMany("Booking", (booking: any) => booking.player)
  bookings!: any[];
}
