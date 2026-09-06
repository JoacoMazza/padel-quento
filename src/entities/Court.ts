import "reflect-metadata";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CourtState } from "@/src/domain/enums";
import { Booking, OutOfService, Schedule } from "@/src/entities";

@Entity({ name: "courts" })
export class Court {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", unique: true })
  number!: number;

  @Column({ type: "enum", enum: CourtState, length: 255 })
  state!: CourtState;

  @OneToMany(() => Booking, (booking) => booking.court)
  bookings!: any[];

  @OneToMany(() => OutOfService, (outOfService) => outOfService.court)
  outOfServices!: any[];

  @OneToMany(() => Schedule, (schedule) => schedule.court)
  schedules!: any[];
}
