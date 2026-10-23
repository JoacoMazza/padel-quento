import "reflect-metadata";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CourtState } from "@/src/domain/enums";
import type { Booking } from "@/src/entities/Booking";
import type { OutOfService } from "@/src/entities/OutOfService";
import type { Schedule } from "@/src/entities/Schedule";

@Entity({ name: "courts" })
export class Court {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", unique: true })
  number!: number;

  @Column({ type: "enum", enum: CourtState })
  state!: CourtState;

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

  @OneToMany("Booking", "court")
  bookings!: Booking[];

  @OneToMany("OutOfService", "court")
  outOfServices!: OutOfService[];

  @OneToMany("Schedule", "court")
  schedules!: Schedule[];
}
