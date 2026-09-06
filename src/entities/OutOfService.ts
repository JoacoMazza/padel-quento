import "reflect-metadata";
import { ChildEntity, Column, ManyToOne } from "typeorm";
import { OutOfServiceReason } from "@/src/domain/enums";
import { Court } from "@/src/entities/Court";

@ChildEntity()
export class OutOfService {
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
