import "reflect-metadata";
import { Check, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type { Court } from "@/src/entities/Court";

const coordinate = {
  to: (value: number) => value,
  from: (value: string | number) => (typeof value === "string" ? parseFloat(value) : value),
};

/** Complejo donde están las canchas, con su ubicación. */
@Entity({ name: "complexes" })
@Check("CHK_complexes_latitude", `"latitude" BETWEEN -90 AND 90`)
@Check("CHK_complexes_longitude", `"longitude" BETWEEN -180 AND 180`)
export class Complex {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  address!: string;

  @Column({ type: "varchar", length: 100 })
  city!: string;

  @Column({ type: "varchar", length: 100 })
  province!: string;

  @Column({ type: "varchar", length: 10, name: "postal_code" })
  postalCode!: string;

  @Column({ type: "decimal", precision: 9, scale: 6, transformer: coordinate })
  latitude!: number;

  @Column({ type: "decimal", precision: 9, scale: 6, transformer: coordinate })
  longitude!: number;

  @Column({ type: "varchar", length: 500, name: "maps_url", nullable: true })
  mapsUrl!: string | null;

  @OneToMany("Court", "complex")
  courts!: Court[];
}
