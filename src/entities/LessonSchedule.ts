import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { DayOfWeek } from "@/src/domain/enums";
import type { Court } from "@/src/entities/Court";
import type { Lesson } from "@/src/entities/Lesson";

/** Horario semanal de una clase: en qué cancha, qué día y de qué hora a qué hora. */
@Entity({ name: "lesson_schedules" })
@Unique("UQ_lesson_schedules_lesson_day_start", ["lesson", "dayOfWeek", "startTime"])
export class LessonSchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Lesson", "schedules", { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "lesson_id", foreignKeyConstraintName: "FK_lesson_schedules_lesson_id" })
  lesson!: Lesson;

  @ManyToOne("Court", { nullable: false })
  @JoinColumn({ name: "court_id", foreignKeyConstraintName: "FK_lesson_schedules_court_id" })
  court!: Court;

  @Column({ type: "enum", enum: DayOfWeek, name: "day_of_week" })
  dayOfWeek!: DayOfWeek;

  @Column({ type: "time", name: "start_time" })
  startTime!: string;

  @Column({ type: "time", name: "end_time" })
  endTime!: string;
}
