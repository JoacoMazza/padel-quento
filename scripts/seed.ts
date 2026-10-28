import "reflect-metadata";
import dataSource from "@/src/lib/data-source";
import { Account } from "@/src/entities/Account";
import { Admin } from "@/src/entities/Admin";
import { Player } from "@/src/entities/Player";
import { AdminAccessLevel } from "@/src/domain/enums";
import { seedCourts } from "./production-seed";

async function main() {
  await dataSource.initialize();

  const { courtsCreated, schedulesCreated } = await seedCourts(dataSource);
  console.log(`Canchas creadas: ${courtsCreated}`);
  console.log(`Horarios creados: ${schedulesCreated}`);

  // Crear cuentas de prueba (dueño, trabajador y jugador)
  const bcrypt = await import("bcrypt");
  const accounts = dataSource.getRepository(Account);
  const admins = dataSource.getRepository(Admin);
  const players = dataSource.getRepository(Player);

  const adminEmail = "admin@quento.com";
  const existingAdmin = await accounts.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    const account = await accounts.save(accounts.create({ email: adminEmail, passwordHash }));
    // El admin del seed es el dueño: puede crear al resto del equipo desde el panel.
    await admins.save(
      admins.create({ account, names: "Administrador", lastnames: "Quento", dni: 30111222, accessLevel: AdminAccessLevel.OWNER }),
    );
    console.log("Usuario Administrador creado: admin@quento.com / admin123");
  }

  // Un trabajador (admin con nivel staff) para probar lo que ve y puede hacer sin ser el dueño.
  const staffEmail = "trabajador@quento.com";
  const existingStaff = await accounts.findOne({ where: { email: staffEmail } });
  if (!existingStaff) {
    const passwordHash = await bcrypt.hash("trabajador123", 12);
    const account = await accounts.save(accounts.create({ email: staffEmail, passwordHash }));
    await admins.save(
      admins.create({ account, names: "Rocío", lastnames: "Fernández", dni: 35123456, accessLevel: AdminAccessLevel.STAFF }),
    );
    console.log("Usuario Trabajador creado: trabajador@quento.com / trabajador123");
  }

  const playerEmail = "jugador@quento.com";
  const existingPlayer = await accounts.findOne({ where: { email: playerEmail } });
  if (!existingPlayer) {
    const passwordHash = await bcrypt.hash("jugador123", 12);
    const account = await accounts.save(accounts.create({ email: playerEmail, passwordHash }));
    await players.save(
      players.create({ account, names: "Juan", lastnames: "Perez", phoneNumber: "2215550000" }),
    );
    console.log("Usuario Jugador creado: jugador@quento.com / jugador123");
  }

  await dataSource.destroy();
}

main().catch((error) => {
  console.error("Error al sembrar datos:", error);
  process.exit(1);
});
