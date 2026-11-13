import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { In } from "typeorm";
import { BookingState, FixedBookingDateState, PlayerCategory } from "@/src/domain/enums";
import type { Account } from "@/src/entities/Account";
import type { Booking } from "@/src/entities/Booking";
import type { Chat } from "@/src/entities/Chat";
import type { FixedBooking } from "@/src/entities/FixedBooking";
import type { FixedBookingDate } from "@/src/entities/FixedBookingDate";
import type { Lesson } from "@/src/entities/Lesson";
import type { Match } from "@/src/entities/Match";
import type { Message } from "@/src/entities/Message";
import type { Player } from "@/src/entities/Player";
import type { PlayerReview } from "@/src/entities/PlayerReview";
import { getDataSource } from "@/src/lib/db";
import { createPlayer } from "@/src/actions/player";
import { DEMO_TEACHERS, planDemoSeed, seedDemoData, type DemoPlan } from "@/scripts/demo-seed";
import { createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

let seq = 0;
async function newPlayer() {
  seq += 1;
  const created = await createPlayer({
    names: `Demo${seq}`,
    lastnames: "Seed",
    email: `demo.seed.${Date.now()}.${seq}@test.com`,
    password: "secreto123",
    phoneNumber: uniquePhoneNumber(),
  });
  if (!created.success) throw new Error(created.error);
  return created.data.id;
}

// Cada test usa canchas nuevas: los turnos de un test no ocupan los del siguiente.
async function setup() {
  const courts = [];
  for (let i = 0; i < 8; i++) {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price: 12000 });
    courts.push({ id: court.data.id });
  }
  const playerIds = [];
  for (let i = 0; i < 6; i++) playerIds.push(await newPlayer());
  const plan = planDemoSeed({ now: new Date(), courts });
  return { plan, playerIds };
}

// Los profesores de ejemplo tienen emails fijos: se borran (con sus clases) entre tests.
async function removeDemoTeachers() {
  const dataSource = await getDataSource();
  const teachers = await dataSource
    .getRepository<Player>("Player")
    .find({ where: { account: { email: In(DEMO_TEACHERS.map((t) => t.email)) } }, relations: { lessons: true } });
  const lessonIds = teachers.flatMap((t) => t.lessons.map((l) => l.id));
  if (lessonIds.length > 0) {
    await dataSource.getRepository<Booking>("Booking").delete({ lesson: { id: In(lessonIds) } });
    await dataSource.getRepository<Lesson>("Lesson").delete({ id: In(lessonIds) });
  }
  await dataSource.getRepository<Account>("Account").delete({ email: In(DEMO_TEACHERS.map((t) => t.email)) });
}

const totalPlayers = (match: DemoPlan["matches"][number]) => match.players.reduce((sum, p) => sum + p.playersCount, 0);

describe("seedDemoData", () => {
  beforeEach(removeDemoTeachers);
  afterAll(removeDemoTeachers);

  it("crea los profesores con sus clases, horarios, alumnos y turnos", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();

    const result = await seedDemoData(dataSource, { plan, playerIds });

    expect(result).toEqual({ lessons: 2, fixedBookings: 2, matches: plan.matches.length });
    const lessons = await dataSource.getRepository<Lesson>("Lesson").find({
      where: { teacher: { account: { email: In(DEMO_TEACHERS.map((t) => t.email)) } } },
      relations: { teacher: { account: true }, schedules: { court: true }, inscriptions: { player: true }, bookings: { booker: true } },
      order: { id: "ASC" },
    });
    expect(lessons).toHaveLength(2);
    lessons.forEach((lesson, i) => {
      const planned = plan.lessons[i];
      expect(lesson.isActive).toBe(true);
      expect(lesson.teacher.account.email).toBe(DEMO_TEACHERS[planned.teacher].email);
      expect(lesson.classCapacity).toBe(planned.classCapacity);
      expect(lesson.schedules).toHaveLength(planned.schedules.length);
      expect(lesson.inscriptions.map((ins) => ins.player.id).sort()).toEqual(
        planned.students.map((s) => playerIds[s]).sort(),
      );
      expect(lesson.bookings).toHaveLength(planned.sessions.length);
      expect(lesson.bookings.every((b) => b.booker.id === lesson.teacher.id)).toBe(true);
      const now = Date.now();
      for (const booking of lesson.bookings) {
        const isPast = booking.fromDateTime.getTime() < now;
        expect(booking.bookingState).toBe(isPast ? BookingState.FINISHED : BookingState.RESERVED);
        expect(booking.isPaid).toBe(isPast);
      }
    });
  });

  it("les carga una categoría a los jugadores de ejemplo que no tienen", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();

    await seedDemoData(dataSource, { plan, playerIds });

    const players = await dataSource.getRepository<Player>("Player").find({ where: { id: In(playerIds) } });
    expect(players.every((p) => p.category !== PlayerCategory.WITHOUT_CATEGORY)).toBe(true);
  });

  it("crea los turnos fijos con todas sus fechas reservadas a nombre del titular", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();

    await seedDemoData(dataSource, { plan, playerIds });

    const fixedBookings = await dataSource.getRepository<FixedBooking>("FixedBooking").find({
      where: { court: { id: In(plan.fixedBookings.map((f) => f.courtId)) } },
      relations: { court: true, booker: true, dates: { booking: { booker: true } } },
    });
    expect(fixedBookings).toHaveLength(2);
    for (const fixed of fixedBookings) {
      const planned = plan.fixedBookings.find((f) => f.courtId === fixed.court.id)!;
      expect(fixed.isActive).toBe(true);
      expect(fixed.frequency).toBe(planned.frequency);
      expect(fixed.booker.id).toBe(playerIds[planned.holder]);
      expect(fixed.dates).toHaveLength(planned.dates.length);
      expect(fixed.dates.every((d) => d.state === FixedBookingDateState.BOOKED && d.booking?.booker.id === fixed.booker.id)).toBe(
        true,
      );
    }
  });

  it("crea los partidos abiertos con sus jugadores, chat, mensajes y reseñas", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();

    await seedDemoData(dataSource, { plan, playerIds });

    for (const planned of plan.matches) {
      const match = await dataSource.getRepository<Match>("Match").findOneOrFail({
        where: { booking: { court: { id: planned.courtId }, fromDateTime: planned.start } },
        relations: { booking: { booker: true }, matchPlayers: { player: true }, chat: true },
      });
      const isPast = planned.start.getTime() < Date.now();
      expect(match.booking.booker.id).toBe(playerIds[planned.players[0].player]);
      expect(match.booking.bookingState).toBe(isPast ? BookingState.FINISHED : BookingState.RESERVED);
      expect(match.needPlayers).toBe(totalPlayers(planned) < 4);
      expect(
        match.matchPlayers
          .map((mp) => [mp.player.id, mp.playersCount, mp.attendedCount])
          .sort((a, b) => a[0] - b[0]),
      ).toEqual(
        planned.players.map((p) => [playerIds[p.player], p.playersCount, p.playersCount]).sort((a, b) => a[0] - b[0]),
      );

      if (planned.players.length < 2) {
        expect(match.chat ?? null).toBeNull();
      } else {
        const chat = await dataSource.getRepository<Chat>("Chat").findOneByOrFail({ match: { id: match.id } });
        const messages = await dataSource.getRepository<Message>("Message").find({ where: { chat: { id: chat.id } } });
        expect(messages).toHaveLength(planned.messages.length);
      }

      const reviews = await dataSource.getRepository<PlayerReview>("PlayerReview").count({ where: { match: { id: match.id } } });
      const n = planned.players.length;
      expect(reviews).toBe(planned.withReviews ? n * (n - 1) : 0);
    }
  });

  it("saltea los turnos que ya están ocupados", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const takenMatch = plan.matches[0];
    const takenFixed = plan.fixedBookings[0].dates[0];
    for (const slot of [takenMatch, takenFixed]) {
      await bookings.save(
        bookings.create({
          fromDateTime: slot.start,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          price: 12000,
          booker: { id: playerIds[5] },
          court: { id: slot.courtId },
        }),
      );
    }

    const result = await seedDemoData(dataSource, { plan, playerIds });

    expect(result?.matches).toBe(plan.matches.length - 1);
    const date = await dataSource.getRepository<FixedBookingDate>("FixedBookingDate").findOneOrFail({
      where: { date: takenFixed.date, fixedBooking: { court: { id: takenFixed.courtId } } },
      relations: { booking: true },
    });
    expect(date.state).toBe(FixedBookingDateState.CONFLICT);
    expect(date.booking).toBeNull();
  });

  it("si los datos de ejemplo ya están cargados no hace nada", async () => {
    const dataSource = await getDataSource();
    const { plan, playerIds } = await setup();
    await seedDemoData(dataSource, { plan, playerIds });

    const again = await seedDemoData(dataSource, { plan, playerIds });

    expect(again).toBeNull();
    expect(await dataSource.getRepository<Lesson>("Lesson").count({ where: { teacher: { account: { email: DEMO_TEACHERS[0].email } } } })).toBe(1);
  });
});
