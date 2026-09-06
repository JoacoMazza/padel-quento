import "reflect-metadata";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { OutOfServiceReason } from "@/src/domain/enums";
import { Court } from "@/src/entities/Court";

@Entity({ name: "out_of_services" })
export class OutOfService {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "datetime" })
  fromDateTime!: Date;

  @Column({ type: "datetime"})
  toDateTime!: Date;

  @Column({ type: "enum", enum: OutOfServiceReason, length: 255 })
  reason!: OutOfServiceReason;

  @Column({ type: "varchar", length: 255, nullable: true })
  description!: string;

  @ManyToOne(() => Court, (court) => court.outOfServices)
  court!: Court;
}
