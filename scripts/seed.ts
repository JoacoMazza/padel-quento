import "reflect-metadata";
import dataSource from "@/src/lib/data-source";
import { Court } from "@/src/entities/Court";
import { Schedule } from "@/src/entities/Schedule";
import { User } from "@/src/entities/User";
import { Player } from "@/src/entities/Player";
import { CourtState, DayOfWeek, Role } from "@/src/domain/enums";

const COURT_COUNT = 8;
const OPENING_TIME = "09:00:00";
const CLOSING_TIME = "23:00:00";
const ALL_DAYS = Object.values(DayOfWeek);

async function main() {
  await dataSource.initialize();

  const courts = dataSource.getRepository(Court);
  const schedules = dataSource.getRepository(Schedule);

  let courtsCreated = 0;
  for (let number = 1; number <= COURT_COUNT; number++) {
    const exists = await courts.findOne({ where: { number } });
    if (exists) continue;
    await courts.save(courts.create({ number, state: CourtState.AVAILABLE }));
    courtsCreated++;
  }

  const allCourts = await courts.find();
  const existingSchedules = await schedules.find({ relations: { court: true } });
  const existingKeys = new Set(existingSchedules.map((s) => `${s.court.id}:${s.dayOfWeek}`));

  let schedulesCreated = 0;
  for (const court of allCourts) {
    for (const dayOfWeek of ALL_DAYS) {
      const key = `${court.id}:${dayOfWeek}`;
      if (existingKeys.has(key)) continue;

      await schedules.save(
        schedules.create({
          dayOfWeek,
          // La columna es "time"; node-postgres serializa el string tal cual, sin ambigüedad de zona horaria.
          openingTime: OPENING_TIME as unknown as Date,
          closingTime: CLOSING_TIME as unknown as Date,
          court: { id: court.id },
        }),
      );
      existingKeys.add(key);
      schedulesCreated++;
    }
  }

  console.log(`Canchas creadas: ${courtsCreated} (${allCourts.length}/${COURT_COUNT} en total)`);
  console.log(
    `Horarios creados: ${schedulesCreated} (${existingKeys.size}/${allCourts.length * ALL_DAYS.length} en total)`,
  );

  // Crear usuarios de prueba (Admin y Jugador)
  const bcrypt = await import("bcrypt");
  const users = dataSource.getRepository(User);
  const players = dataSource.getRepository(Player);

  const adminEmail = "admin@quento.com";
  const existingAdmin = await users.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    await users.save(
      users.create({
        email: adminEmail,
        names: "Administrador",
        lastnames: "Quento",
        passwordHash,
        role: Role.ADMIN,
      }),
    );
    console.log("Usuario Administrador creado: admin@quento.com / admin123");
  }

  const playerEmail = "jugador@quento.com";
  const existingPlayer = await players.findOne({ where: { email: playerEmail } });
  if (!existingPlayer) {
    const passwordHash = await bcrypt.hash("jugador123", 12);
    await players.save(
      players.create({
        email: playerEmail,
        names: "Juan",
        lastnames: "Perez",
        passwordHash,
        role: Role.PLAYER,
      }),
    );
    console.log("Usuario Jugador creado: jugador@quento.com / jugador123");
  }

  await dataSource.destroy();
}

main().catch((error) => {
  console.error("Error al sembrar datos:", error);
  process.exit(1);
});
