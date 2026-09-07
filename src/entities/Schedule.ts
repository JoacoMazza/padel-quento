import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { DayOfWeek } from "@/src/domain/enums";
import type { Court } from "@/src/entities/Court";

@Entity({ name: "schedules" })
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: DayOfWeek, name: "day_of_week" })
  dayOfWeek!: DayOfWeek;

  @Column({ type: "time", default: '09:00:00', name: "opening_time" })
  openingTime!: Date;

  @Column({ type: "time", default: '23:00:00', name: "closing_time" })
  closingTime!: Date;

  @ManyToOne("Court", (court: any) => court.schedules)
  @JoinColumn({ name: "court_id" })
  court!: Court;
}
