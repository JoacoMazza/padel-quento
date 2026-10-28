import "reflect-metadata";
import dataSource from "@/src/lib/data-source";
import { readOwnerFromEnv, seedCourts, seedOwner } from "./production-seed";

async function main() {
  const ownerFromEnv = readOwnerFromEnv(process.env);
  if ("error" in ownerFromEnv) throw new Error(ownerFromEnv.error);

  await dataSource.initialize();

  const { courtsCreated, schedulesCreated } = await seedCourts(dataSource);
  console.log(`Canchas creadas: ${courtsCreated}`);
  console.log(`Horarios creados: ${schedulesCreated}`);

  if (!ownerFromEnv.owner) {
    console.log("Sin variables SEED_OWNER_*: no se creó la cuenta del dueño.");
  } else if (await seedOwner(dataSource, ownerFromEnv.owner)) {
    console.log(`Cuenta del dueño creada: ${ownerFromEnv.owner.email}`);
  } else {
    console.log(`Ya existe una cuenta con el email ${ownerFromEnv.owner.email}: no se creó el dueño.`);
  }

  await dataSource.destroy();
}

main().catch((error) => {
  console.error("Error al sembrar datos de producción:", error);
  process.exit(1);
});
