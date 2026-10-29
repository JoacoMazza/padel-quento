import type { EntityManager } from "typeorm";
import type { Complex } from "@/src/entities/Complex";

/**
 * Complejo del club: el primero que se cargó (lo crea la migración de
 * complejos). Las canchas nuevas se asocian a él.
 */
export function findClubComplex(manager: Pick<EntityManager, "getRepository">): Promise<Complex | null> {
  return manager.getRepository<Complex>("Complex").findOne({ where: {}, order: { id: "ASC" } });
}
