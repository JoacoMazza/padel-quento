import type { DataSource } from "typeorm";
import { Account } from "@/src/entities/Account";
import { Admin } from "@/src/entities/Admin";
import { Court } from "@/src/entities/Court";
import { Schedule } from "@/src/entities/Schedule";
import { AdminAccessLevel, CourtState, DayOfWeek } from "@/src/domain/enums";

const COURT_COUNT = 8;
const COURT_PRICE = 10000;
const OPENING_TIME = "09:00:00";
const CLOSING_TIME = "23:00:00";
const ALL_DAYS = Object.values(DayOfWeek);

/**
 * Crea, si no existen, las canchas 1 a 8 con horario de 09:00 a 23:00 los 7 días.
 * No modifica canchas ni horarios que ya existan.
 */
export async function seedCourts(dataSource: DataSource) {
  const courts = dataSource.getRepository(Court);
  const schedules = dataSource.getRepository(Schedule);

  let courtsCreated = 0;
  let schedulesCreated = 0;
  for (let number = 1; number <= COURT_COUNT; number++) {
    let court = await courts.findOne({ where: { number } });
    if (!court) {
      court = await courts.save(courts.create({ number, state: CourtState.AVAILABLE, price: COURT_PRICE }));
      courtsCreated++;
    }

    const existingDays = new Set(
      (await schedules.find({ where: { court: { id: court.id } } })).map((s) => s.dayOfWeek),
    );
    for (const dayOfWeek of ALL_DAYS) {
      if (existingDays.has(dayOfWeek)) continue;
      await schedules.save(
        schedules.create({
          dayOfWeek,
          // La columna es "time"; node-postgres serializa el string tal cual, sin ambigüedad de zona horaria.
          openingTime: OPENING_TIME as unknown as Date,
          closingTime: CLOSING_TIME as unknown as Date,
          court: { id: court.id },
        }),
      );
      schedulesCreated++;
    }
  }

  return { courtsCreated, schedulesCreated };
}

export type OwnerInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  dni: number;
};

/** Crea la cuenta del dueño, salvo que ya exista una cuenta con ese email. */
export async function seedOwner(dataSource: DataSource, input: OwnerInput): Promise<boolean> {
  const accounts = dataSource.getRepository(Account);
  const admins = dataSource.getRepository(Admin);
  if (await accounts.findOne({ where: { email: input.email } })) return false;

  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const account = await accounts.save(accounts.create({ email: input.email, passwordHash }));
  await admins.save(
    admins.create({
      account,
      names: input.names,
      lastnames: input.lastnames,
      dni: input.dni,
      accessLevel: AdminAccessLevel.OWNER,
    }),
  );
  return true;
}

const OWNER_ENV_VARS = [
  "SEED_OWNER_EMAIL",
  "SEED_OWNER_PASSWORD",
  "SEED_OWNER_NAMES",
  "SEED_OWNER_LASTNAMES",
  "SEED_OWNER_DNI",
] as const;

/**
 * Lee los datos del dueño de las variables SEED_OWNER_*, para no dejar
 * credenciales de producción en el repo. Sin ninguna cargada no hay dueño.
 */
export function readOwnerFromEnv(
  env: Record<string, string | undefined>,
): { owner: OwnerInput | null } | { error: string } {
  const missing = OWNER_ENV_VARS.filter((name) => !env[name]);
  if (missing.length === OWNER_ENV_VARS.length) return { owner: null };
  if (missing.length > 0) return { error: `Faltan variables para crear al dueño: ${missing.join(", ")}` };
  if (!/^\d+$/.test(env.SEED_OWNER_DNI!)) return { error: "SEED_OWNER_DNI debe ser un número sin puntos" };

  return {
    owner: {
      email: env.SEED_OWNER_EMAIL!,
      password: env.SEED_OWNER_PASSWORD!,
      names: env.SEED_OWNER_NAMES!,
      lastnames: env.SEED_OWNER_LASTNAMES!,
      dni: Number(env.SEED_OWNER_DNI),
    },
  };
}
