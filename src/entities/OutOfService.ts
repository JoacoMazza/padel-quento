import "reflect-metadata";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OutOfServiceReason } from "@/src/domain/enums";
import type { Court } from "@/src/entities/Court";

@Entity({ name: "out_of_services" })
export class OutOfService {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "timestamp", name: "from_datetime" })
  fromDateTime!: Date;

  @Column({ type: "timestamp", name: "to_datetime" })
  toDateTime!: Date;

  @Column({ type: "enum", enum: OutOfServiceReason })
  reason!: OutOfServiceReason;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @ManyToOne("Court", (court: any) => court.outOfServices)
  @JoinColumn({ name: "court_id" })
  court!: Court;
}
