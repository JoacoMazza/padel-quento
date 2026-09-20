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

  @Column({
    type: "varchar",
    length: 255,
    default: "Cam. Centenario 8907, B1894 Villa Elisa, Provincia de Buenos Aires",
  })
  location!: string;

  @OneToMany("Booking", (booking: any) => booking.court)
  bookings!: any[];

  @OneToMany("OutOfService", (outOfService: any) => outOfService.court)
  outOfServices!: any[];

  @OneToMany("Schedule", (schedule: any) => schedule.court)
  schedules!: any[];
}
