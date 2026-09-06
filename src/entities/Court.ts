import "reflect-metadata";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CourtState } from "@/src/domain/enums";

@Entity({ name: "courts" })
export class Court {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", unique: true })
  number!: number;

  @Column({ type: "enum", enum: CourtState })
  state!: CourtState;

  @OneToMany("Booking", (booking: any) => booking.court)
  bookings!: any[];

  @OneToMany("OutOfService", (outOfService: any) => outOfService.court)
  outOfServices!: any[];

  @OneToMany("Schedule", (schedule: any) => schedule.court)
  schedules!: any[];
}
