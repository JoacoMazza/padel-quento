import "reflect-metadata";
import { ChildEntity, Column, OneToMany } from "typeorm";
import { PlayerCategory } from "@/src/domain/enums";
import { User } from "@/src/entities/User";
import type { PointsMovement } from "@/src/entities/PointsMovement";


@ChildEntity()
export class Player extends User {
  @Column({
    type: "varchar",
    default: PlayerCategory.WITHOUT_CATEGORY,
  })
  category!: PlayerCategory;

  @Column({ type: "float", default: 0 })
  scoring!: number;

  @OneToMany("PointsMovement", "player")
  movements!: PointsMovement[];
}
