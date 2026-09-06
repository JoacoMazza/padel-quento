import "reflect-metadata";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { DayOfWeek } from "@/src/domain/enums";
import { Court } from "@/src/entities";

@Entity({ name: "schedules" })
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "enum", enum: DayOfWeek, length: 255 })
  dayOfWeek!: DayOfWeek;

  @Column({ type: "datetime", default: '09:00:00' })
  openingTime!: Date;

  @Column({ type: "datetime", default: '23:00:00' })
  closingTime!: Date;

  @ManyToOne(() => Court, (court) => court.schedules)
  court!: Court;
}
