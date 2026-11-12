import "reflect-metadata";
import { Between, In, Not } from "typeorm";
import dataSource from "@/src/lib/data-source";
import { Account } from "@/src/entities/Account";
import { Booking } from "@/src/entities/Booking";
import { Penalty } from "@/src/entities/Penalty";
import { Court } from "@/src/entities/Court";
import { Player } from "@/src/entities/Player";
import { Schedule } from "@/src/entities/Schedule";
import { BookingState } from "@/src/domain/enums";
import { NO_SHOW_PENALTY_REASON } from "@/src/domain/attendance";
import { generateSeedBookings } from "./booking-seed";
import { DEMO_TEACHER_PASSWORD, DEMO_TEACHERS, demoSlots, planDemoSeed, seedDemoData } from "./demo-seed";

const PAST_DAYS = 90;
const FUTURE_DAYS = 30;
const SEED_PLAYER_COUNT = 6;
const SEED_PLAYER_PASSWORD = "jugador123";
const seedPlayerEmail = (n: number) => `seed.jugador${n}@quento.com`;

/** Jugadores de ejemplo a los que se asignan los turnos (se crean si no existen). */
async function ensureSeedPlayers(): Promise<number> {
  const bcrypt = await import("bcrypt");
  const accounts = dataSource.getRepository(Account);
  const players = dataSource.getRepository(Player);
  let created = 0;

  for (let n = 1; n <= SEED_PLAYER_COUNT; n++) {
    const email = seedPlayerEmail(n);
    const phoneNumber = `22155501${String(n).padStart(2, "0")}`;
    if (await accounts.findOne({ where: { email } })) continue;
    if (await players.findOne({ where: { phoneNumber } })) continue;

    const passwordHash = await bcrypt.hash(SEED_PLAYER_PASSWORD, 12);
    const account = await accounts.save(accounts.create({ email, passwordHash }));
    await players.save(players.create({ account, names: `Jugador ${n}`, lastnames: "Seed", phoneNumber }));
    created++;
  }
  return created;
}

async function main() {
  await dataSource.initialize();

  const playersCreated = await ensureSeedPlayers();
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - PAST_DAYS);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FUTURE_DAYS, 23, 59, 59, 999);

  const courts = await dataSource.getRepository(Court).find({ order: { number: "ASC" } });
  const schedules = await dataSource.getRepository(Schedule).find({ relations: { court: true } });
  const players = await dataSource.getRepository(Player).find();
  const bookings = dataSource.getRepository(Booking);
  // Los cancelados no ocupan la cancha: se puede generar un turno en su lugar.
  const existing = await bookings.find({
    where: { fromDateTime: Between(from, to), bookingState: Not(BookingState.CANCELLED) },
    relations: { court: true },
  });

  if (courts.length === 0 || schedules.length === 0) {
    console.log("No hay canchas u horarios: corré primero `pnpm db:seed`.");
    await dataSource.destroy();
    return;
  }

  // Clases, turnos fijos y partidos abiertos de ejemplo: sus horarios quedan libres de turnos sueltos.
  const plan = planDemoSeed({ now, courts, futureDays: FUTURE_DAYS });
  const generated = generateSeedBookings({
    now,
    courts: courts.map((c) => ({ id: c.id, price: c.price })),
    schedules: schedules
      .filter((s) => s.court)
      .map((s) => ({
        courtId: s.court.id,
        dayOfWeek: s.dayOfWeek,
        openingTime: String(s.openingTime),
        closingTime: String(s.closingTime),
      })),
    playerIds: players.map((p) => p.id),
    existing: existing
      .filter((b) => b.court)
      .map((b) => ({ courtId: b.court.id, fromDateTime: b.fromDateTime, durationMinutes: b.durationMinutes })),
    reserved: demoSlots(plan).map((slot) => ({ courtId: slot.courtId, fromDateTime: slot.start })),
    pastDays: PAST_DAYS,
    futureDays: FUTURE_DAYS,
  });

  const saved = await bookings.save(
    generated.map((b) =>
      bookings.create({
        fromDateTime: b.fromDateTime,
        durationMinutes: b.durationMinutes,
        bookingState: b.bookingState,
        price: b.price,
        isPaid: b.isPaid,
        booker: { id: b.bookerId },
        court: { id: b.courtId },
      }),
    ),
    { chunk: 500 },
  );
  // Las inasistencias, ligadas a su turno. Van por 0 puntos para no tocar el
  // saldo de los jugadores de ejemplo, que no se siembra.
  const penalties = dataSource.getRepository(Penalty);
  await penalties.save(
    generated.flatMap((b, i) =>
      b.attended
        ? []
        : [penalties.create({ player: { id: b.bookerId }, booking: { id: saved[i].id }, penalizedScoring: 0, reason: NO_SHOW_PENALTY_REASON })],
    ),
    { chunk: 500 },
  );

  const seedEmails = Array.from({ length: SEED_PLAYER_COUNT }, (_, i) => seedPlayerEmail(i + 1));
  const seedPlayers = await dataSource
    .getRepository(Player)
    .find({ where: { account: { email: In(seedEmails) } }, relations: { account: true } });
  const playerIds = seedEmails.flatMap((email) => seedPlayers.filter((p) => p.account.email === email).map((p) => p.id));
  const demo =
    playerIds.length === SEED_PLAYER_COUNT ? await seedDemoData(dataSource, { plan, playerIds, now }) : null;

  console.log(`Jugadores de ejemplo creados: ${playersCreated} (contraseña: ${SEED_PLAYER_PASSWORD})`);
  console.log(
    `Turnos creados: ${generated.length} (del ${from.toLocaleDateString("es-AR")} al ${to.toLocaleDateString("es-AR")})`,
  );

  if (demo) {
    console.log(
      `Datos de ejemplo: ${demo.lessons} clases, ${demo.fixedBookings} turnos fijos y ${demo.matches} partidos abiertos`,
    );
    console.log(`Profesores: ${DEMO_TEACHERS.map((t) => t.email).join(", ")} (contraseña: ${DEMO_TEACHER_PASSWORD})`);
  } else {
    console.log("Datos de ejemplo (clases, turnos fijos y partidos abiertos): ya estaban cargados.");
  }

  await dataSource.destroy();
}

main().catch((error) => {
  console.error("Error al sembrar turnos:", error);
  process.exit(1);
});
