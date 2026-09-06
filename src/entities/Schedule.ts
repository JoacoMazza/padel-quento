import "reflect-metadata";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { DayOfWeek } from "@/src/domain/enums";
import { Court } from "@/src/entities/Court";

@Entity({ name: "schedules" })
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: DayOfWeek })
  dayOfWeek!: DayOfWeek;

  @Column({ type: "time", default: '09:00:00' })
  openingTime!: Date;

  @Column({ type: "time", default: '23:00:00' })
  closingTime!: Date;

  @ManyToOne(() => Court, (court) => court.schedules)
  court!: Court;
}
