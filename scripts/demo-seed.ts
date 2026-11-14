import type { DataSource, EntityManager } from "typeorm";
import {
  BookingState,
  DayOfWeek,
  FixedBookingDateState,
  FixedBookingFrequency,
  PlayerCategory,
  ReviewLevel,
} from "@/src/domain/enums";
import { addDaysISO, dayOfWeekOfISO, occurrenceDates, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import { lessonOccurrenceDates } from "@/src/domain/lesson";
import { SLOT_DURATION_MINUTES } from "@/app/bookings/slot-utils";
import { isSlotTaken } from "@/src/lib/court-booking";
import type { Account } from "@/src/entities/Account";
import type { Booking } from "@/src/entities/Booking";
import type { Chat } from "@/src/entities/Chat";
import type { Court } from "@/src/entities/Court";
import type { FixedBooking } from "@/src/entities/FixedBooking";
import type { FixedBookingDate } from "@/src/entities/FixedBookingDate";
import type { Inscription } from "@/src/entities/Inscription";
import type { Lesson } from "@/src/entities/Lesson";
import type { LessonSchedule } from "@/src/entities/LessonSchedule";
import type { Match } from "@/src/entities/Match";
import type { MatchPlayer } from "@/src/entities/MatchPlayer";
import type { Message } from "@/src/entities/Message";
import type { Player } from "@/src/entities/Player";
import type { PlayerReview } from "@/src/entities/PlayerReview";

export type DemoSlot = { courtId: number; start: Date; durationMinutes: number };

/** Los jugadores (players, teacher, holder) se indican por su posición en la lista de jugadores de ejemplo. */
export type DemoLesson = {
  teacher: number;
  students: number[];
  classCapacity: number;
  price: number;
  fromDate: string;
  toDate: string | null;
  schedules: Array<{ courtId: number; dayOfWeek: DayOfWeek; startTime: string; endTime: string }>;
  sessions: DemoSlot[];
};

export type DemoFixedBooking = {
  holder: number;
  courtId: number;
  startDate: string;
  startTime: string;
  frequency: FixedBookingFrequency;
  dates: Array<DemoSlot & { date: string }>;
};

export type DemoMatch = DemoSlot & {
  players: Array<{ player: number; playersCount: number }>;
  messages: Array<{ player: number; content: string }>;
  /** Si sus jugadores ya se calificaron entre sí. */
  withReviews: boolean;
};

export type DemoPlan = { lessons: DemoLesson[]; fixedBookings: DemoFixedBooking[]; matches: DemoMatch[] };

/** Profesores de ejemplo: el seed les crea la cuenta (son jugadores con una clase activa). */
export const DEMO_TEACHERS = [
  { email: "seed.profesor1@quento.com", names: "Martín", lastnames: "Gómez", phoneNumber: "2215550201", category: PlayerCategory.SECOND },
  { email: "seed.profesor2@quento.com", names: "Lucía", lastnames: "Romero", phoneNumber: "2215550202", category: PlayerCategory.FIRST },
];
export const DEMO_TEACHER_PASSWORD = "profesor123";

// Para poder crear partidos abiertos, los jugadores de ejemplo necesitan categoría.
const PLAYER_CATEGORIES = [
  PlayerCategory.FOURTH,
  PlayerCategory.FOURTH,
  PlayerCategory.FIFTH,
  PlayerCategory.THIRD,
  PlayerCategory.FOURTH,
  PlayerCategory.FIFTH,
];

function onOrAfter(date: string, dayOfWeek: DayOfWeek): string {
  let current = date;
  while (dayOfWeekOfISO(current) !== dayOfWeek) current = addDaysISO(current, 1);
  return current;
}

function slot(courtId: number, date: string, startTime: string): DemoSlot {
  return { courtId, start: occurrenceStart(date, startTime), durationMinutes: SLOT_DURATION_MINUTES };
}

/**
 * Datos de ejemplo alrededor de `now`, para ver la app con uso real: dos clases
 * (con profesor, alumnos y turnos ya dados y por venir), un turno fijo semanal y
 * otro quincenal tomados desde hace unas semanas, y partidos abiertos con lugares
 * libres, completos y ya jugados (uno para calificar y otro ya calificado).
 * Las canchas se toman por posición (la 1ª es la "cancha 1").
 */
export function planDemoSeed({
  now,
  courts,
  futureDays = 30,
}: {
  now: Date;
  courts: Array<{ id: number }>;
  futureDays?: number;
}): DemoPlan {
  const today = todayISO(now);
  const until = addDaysISO(today, futureDays);
  const court = (number: number) => courts[(number - 1) % courts.length].id;
  const day = (offset: number) => addDaysISO(today, offset);

  const lessons = [
    {
      teacher: 0,
      students: [0, 1, 2],
      classCapacity: 4,
      price: 15000,
      fromDate: day(-21),
      toDate: null,
      schedules: [
        { courtId: court(8), dayOfWeek: DayOfWeek.MONDAY, startTime: "09:00", endTime: "10:30" },
        { courtId: court(8), dayOfWeek: DayOfWeek.WEDNESDAY, startTime: "09:00", endTime: "10:30" },
      ],
    },
    {
      teacher: 1,
      students: [3, 4],
      classCapacity: 2,
      price: 18000,
      fromDate: day(-14),
      toDate: day(28),
      schedules: [
        { courtId: court(7), dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:30", endTime: "12:00" },
        { courtId: court(7), dayOfWeek: DayOfWeek.THURSDAY, startTime: "10:30", endTime: "12:00" },
      ],
    },
  ].map((lesson) => {
    const lastDate = lesson.toDate && lesson.toDate < until ? lesson.toDate : until;
    const sessions = lesson.schedules
      .flatMap((s) => lessonOccurrenceDates(s.dayOfWeek, lesson.fromDate, lastDate).map((date) => slot(s.courtId, date, s.startTime)))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    return { ...lesson, sessions };
  });

  const fixedBookings = [
    { holder: 5, courtId: court(1), startDate: onOrAfter(day(-28), DayOfWeek.FRIDAY), startTime: "19:30", frequency: FixedBookingFrequency.WEEKLY },
    { holder: 0, courtId: court(2), startDate: onOrAfter(day(-21), DayOfWeek.SATURDAY), startTime: "18:00", frequency: FixedBookingFrequency.BIWEEKLY },
  ].map((fixed) => ({
    ...fixed,
    dates: occurrenceDates({ startDate: fixed.startDate, frequency: fixed.frequency, endDate: null }, fixed.startDate, until).map(
      (date) => ({ date, ...slot(fixed.courtId, date, fixed.startTime) }),
    ),
  }));

  const matches: DemoMatch[] = [
    // Con lugares libres.
    { ...slot(court(3), day(1), "18:00"), players: [{ player: 0, playersCount: 1 }], messages: [], withReviews: false },
    {
      ...slot(court(4), day(2), "19:30"),
      players: [
        { player: 1, playersCount: 2 },
        { player: 2, playersCount: 1 },
      ],
      messages: [
        { player: 2, content: "¡Hola! Me sumo, ¿falta uno nomás?" },
        { player: 1, content: "Sí, falta uno. Lo compartí en el grupo del club." },
      ],
      withReviews: false,
    },
    { ...slot(court(5), day(3), "21:00"), players: [{ player: 3, playersCount: 1 }], messages: [], withReviews: false },
    // Completo: ya no busca jugadores.
    {
      ...slot(court(6), day(1), "21:00"),
      players: [
        { player: 4, playersCount: 2 },
        { player: 5, playersCount: 1 },
        { player: 0, playersCount: 1 },
      ],
      messages: [
        { player: 5, content: "¿Quién lleva pelotas?" },
        { player: 4, content: "Yo llevo un tubo nuevo." },
        { player: 0, content: "Genial, nos vemos 20:50 en recepción." },
      ],
      withReviews: false,
    },
    // Jugado ayer: sus jugadores todavía pueden calificarse.
    {
      ...slot(court(4), day(-1), "19:30"),
      players: [
        { player: 0, playersCount: 2 },
        { player: 1, playersCount: 1 },
        { player: 2, playersCount: 1 },
      ],
      messages: [
        { player: 1, content: "¿Jugamos al mejor de tres sets?" },
        { player: 0, content: "Dale, buen partido para todos." },
      ],
      withReviews: false,
    },
    // Jugado hace unos días y ya calificado.
    {
      ...slot(court(3), day(-5), "18:00"),
      players: [1, 2, 3, 4].map((player) => ({ player, playersCount: 1 })),
      messages: [{ player: 3, content: "¡Gracias por el partido!" }],
      withReviews: true,
    },
  ];

  return { lessons, fixedBookings, matches };
}

/** Todos los turnos del plan, para que el seed de turnos los deje libres. */
export function demoSlots(plan: DemoPlan): DemoSlot[] {
  return [
    ...plan.lessons.flatMap((l) => l.sessions),
    ...plan.fixedBookings.flatMap((f) => f.dates),
    ...plan.matches,
  ].map(({ courtId, start, durationMinutes }) => ({ courtId, start, durationMinutes }));
}

/**
 * Reserva el turno si está libre: los pasados quedan finalizados y pagos, los
 * futuros reservados. Devuelve null si ya estaba ocupado.
 */
async function reserve(
  manager: EntityManager,
  demo: DemoSlot,
  bookerId: number,
  now: Date,
  lessonId?: number,
): Promise<Booking | null> {
  if (await isSlotTaken(manager, demo.courtId, demo.start, demo.durationMinutes)) return null;
  const court = await manager.getRepository<Court>("Court").findOneByOrFail({ id: demo.courtId });
  const isPast = demo.start < now;
  const bookings = manager.getRepository<Booking>("Booking");
  return bookings.save(
    bookings.create({
      fromDateTime: demo.start,
      durationMinutes: demo.durationMinutes,
      bookingState: isPast ? BookingState.FINISHED : BookingState.RESERVED,
      price: court.price,
      isPaid: isPast,
      booker: { id: bookerId },
      court: { id: demo.courtId },
      ...(lessonId ? { lesson: { id: lessonId } } : {}),
    }),
  );
}

/**
 * Carga el plan en la base: crea los profesores de ejemplo, sus clases, los
 * turnos fijos y los partidos abiertos de los jugadores `playerIds` (en el
 * orden del plan). Los turnos ya ocupados se saltean (las fechas de turnos
 * fijos quedan salteadas, como al crearlos desde el panel). Si los profesores
 * de ejemplo ya existen, los datos ya se cargaron y no hace nada (devuelve null).
 */
export async function seedDemoData(
  dataSource: DataSource,
  { plan, playerIds, now = new Date() }: { plan: DemoPlan; playerIds: number[]; now?: Date },
): Promise<{ lessons: number; fixedBookings: number; matches: number } | null> {
  const accounts = dataSource.getRepository<Account>("Account");
  if (await accounts.findOneBy({ email: DEMO_TEACHERS[0].email })) return null;
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(DEMO_TEACHER_PASSWORD, 12);

  return dataSource.transaction(async (manager) => {
    const players = manager.getRepository<Player>("Player");
    for (const [index, id] of playerIds.entries()) {
      await players.update(
        { id, category: PlayerCategory.WITHOUT_CATEGORY },
        { category: PLAYER_CATEGORIES[index % PLAYER_CATEGORIES.length] },
      );
    }

    const teacherIds: number[] = [];
    for (const teacher of DEMO_TEACHERS) {
      const teacherAccounts = manager.getRepository<Account>("Account");
      const account = await teacherAccounts.save(teacherAccounts.create({ email: teacher.email, passwordHash }));
      const { names, lastnames, phoneNumber, category } = teacher;
      const player = await players.save(players.create({ account, names, lastnames, phoneNumber, category }));
      teacherIds.push(player.id);
    }

    const lessons = manager.getRepository<Lesson>("Lesson");
    for (const planned of plan.lessons) {
      const teacherId = teacherIds[planned.teacher];
      const lesson = await lessons.save(
        lessons.create({
          teacher: { id: teacherId },
          classCapacity: planned.classCapacity,
          price: planned.price,
          isActive: true,
          fromLocalDatetime: occurrenceStart(planned.fromDate, "00:00"),
          toLocalDatetime: planned.toDate ? occurrenceStart(planned.toDate, "23:59") : null,
        }),
      );
      const schedules = manager.getRepository<LessonSchedule>("LessonSchedule");
      await schedules.save(planned.schedules.map((s) => schedules.create({ ...s, lesson: { id: lesson.id }, court: { id: s.courtId } })));
      const inscriptions = manager.getRepository<Inscription>("Inscription");
      await inscriptions.save(
        planned.students.map((s) => inscriptions.create({ lesson: { id: lesson.id }, player: { id: playerIds[s] } })),
      );
      for (const session of planned.sessions) await reserve(manager, session, teacherId, now, lesson.id);
    }

    const fixedBookings = manager.getRepository<FixedBooking>("FixedBooking");
    const fixedDates = manager.getRepository<FixedBookingDate>("FixedBookingDate");
    for (const planned of plan.fixedBookings) {
      const holderId = playerIds[planned.holder];
      const fixed = await fixedBookings.save(
        fixedBookings.create({
          court: { id: planned.courtId },
          booker: { id: holderId },
          startDate: planned.startDate,
          endDate: null,
          startTime: planned.startTime,
          durationMinutes: SLOT_DURATION_MINUTES,
          frequency: planned.frequency,
          isActive: true,
        }),
      );
      for (const date of planned.dates) {
        const booking = await reserve(manager, date, holderId, now);
        await fixedDates.save(
          fixedDates.create({
            fixedBooking: { id: fixed.id },
            date: date.date,
            state: booking ? FixedBookingDateState.BOOKED : FixedBookingDateState.CONFLICT,
            booking,
          }),
        );
      }
    }

    let matchesCreated = 0;
    for (const planned of plan.matches) {
      const ids = planned.players.map((p) => playerIds[p.player]);
      const booking = await reserve(manager, planned, ids[0], now);
      if (!booking) continue;
      const total = planned.players.reduce((sum, p) => sum + p.playersCount, 0);
      const match = await manager
        .getRepository<Match>("Match")
        .save(manager.getRepository<Match>("Match").create({ booking: { id: booking.id }, needPlayers: total < 4 }));
      const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
      await matchPlayers.save(
        planned.players.map((p) =>
          matchPlayers.create({
            match: { id: match.id },
            player: { id: playerIds[p.player] },
            playersCount: p.playersCount,
            attendedCount: p.playersCount,
          }),
        ),
      );
      if (planned.players.length >= 2) {
        const chat = await manager.getRepository<Chat>("Chat").save(manager.getRepository<Chat>("Chat").create({ match: { id: match.id } }));
        const messages = manager.getRepository<Message>("Message");
        for (const message of planned.messages) {
          await messages.save(messages.create({ chat: { id: chat.id }, sender: { id: playerIds[message.player] }, content: message.content }));
        }
      }
      if (planned.withReviews) {
        const reviews = manager.getRepository<PlayerReview>("PlayerReview");
        await reviews.save(
          ids.flatMap((reviewer) =>
            ids
              .filter((reviewed) => reviewed !== reviewer)
              .map((reviewed) =>
                reviews.create({
                  match: { id: match.id },
                  reviewer: { id: reviewer },
                  reviewed: { id: reviewed },
                  level: ReviewLevel.AS_DECLARED,
                  goodAttitude: true,
                  onTime: true,
                  comment: null,
                }),
              ),
          ),
        );
      }
      matchesCreated += 1;
    }

    return { lessons: plan.lessons.length, fixedBookings: plan.fixedBookings.length, matches: matchesCreated };
  });
}
