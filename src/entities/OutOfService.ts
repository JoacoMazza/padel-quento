import "reflect-metadata";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OutOfServiceReason } from "@/src/domain/enums";
import type { Court } from "@/src/entities/Court";

@Entity({ name: "out_of_services" })
export class OutOfService {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "timestamp" })
  fromDateTime!: Date;

  @Column({ type: "timestamp" })
  toDateTime!: Date;

  @Column({ type: "enum", enum: OutOfServiceReason })
  reason!: OutOfServiceReason;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string | null;

  @ManyToOne("Court", (court: any) => court.outOfServices)
  court!: Court;
}
