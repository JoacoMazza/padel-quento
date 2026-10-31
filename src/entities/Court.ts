import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CourtState } from "@/src/domain/enums";
import type { Complex } from "@/src/entities/Complex";

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

  @ManyToOne("Complex", "courts", { nullable: false })
  @JoinColumn({ name: "complex_id" })
  complex!: Complex;

  @OneToMany("Booking", (booking: any) => booking.court)
  bookings!: any[];

  @OneToMany("OutOfService", (outOfService: any) => outOfService.court)
  outOfServices!: any[];

  @OneToMany("Schedule", (schedule: any) => schedule.court)
  schedules!: any[];
}
