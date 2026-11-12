"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Power, Trash2, UserMinus, UserPlus, Users, X } from "lucide-react";
import {
  addLessonStudentAdmin,
  createLesson,
  deactivateLesson,
  getLessonClassesAdmin,
  getLessonsAdmin,
  removeLessonStudentAdmin,
  type LessonItem,
  type TeacherClassItem,
} from "@/src/actions/lesson";
import { getPlayersAdmin, type PlayerAdminItem } from "@/src/actions/player";
import { getCourts } from "@/src/actions/court";
import { CourtState, DayOfWeek } from "@/src/domain/enums";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { formatLongDate, formatPrice } from "@/app/bookings/slot-utils";
import { INPUT_CLASS, LABEL_CLASS } from "@/app/admin/holder-fields";
import { DAY_LABELS, formatDate, scheduleLabel } from "@/app/components/lesson-labels";

function fullName(person: { names: string; lastnames: string }): string {
  return `${person.names} ${person.lastnames}`;
}

type Dialog = "create" | { studentsOf: number } | { classesOf: LessonItem };

/**
 * Sección Clases del panel, para cualquier administrador: alta de una clase
 * asignando a un jugador registrado como profesor (no se le crea una cuenta),
 * con sus fechas y horarios semanales; la inscripción de alumnos, la baja de
 * la clase y la supervisión de sus turnos (HU-48).
 */
export function LessonsPanel({ lessons: initialLessons }: { lessons: LessonItem[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const result = await getLessonsAdmin();
    if (result.success) setLessons(result.data);
  }

  async function handleDeactivate(id: number) {
    setError(null);
    setConfirmingId(null);
    const result = await deactivateLesson(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await reload();
  }

  const studentsOf =
    dialog !== null && typeof dialog === "object" && "studentsOf" in dialog
      ? lessons.find((lesson) => lesson.id === dialog.studentsOf)
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">
          Cada clase la da un jugador registrado, que pasa a ser profesor mientras la clase esté activa.
        </p>
        <button type="button" onClick={() => setDialog("create")} className="btn btn-sm btn-primary">
          <Plus className="h-4 w-4" />
          Nueva clase
        </button>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="table-head">Profesor</th>
              <th className="table-head">Horarios</th>
              <th className="table-head">Fechas</th>
              <th className="table-head">Alumnos</th>
              <th className="table-head">Precio</th>
              <th className="table-head">Estado</th>
              <th className="table-head text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lessons.length === 0 ? (
              <tr>
                <td colSpan={7} className="table-cell text-center text-foreground/60">
                  Todavía no hay clases.
                </td>
              </tr>
            ) : null}
            {lessons.map((lesson) => (
              <tr key={lesson.id}>
                <td className="table-cell font-semibold text-foreground">{lesson.teacherName}</td>
                <td className="table-cell text-foreground/70">
                  {lesson.schedules.map((schedule) => (
                    <p key={`${schedule.dayOfWeek}-${schedule.startTime}`}>{scheduleLabel(schedule)}</p>
                  ))}
                </td>
                <td className="table-cell text-foreground/70">
                  {formatDate(lesson.fromDate)} – {formatDate(lesson.toDate)}
                </td>
                <td className="table-cell text-foreground/70">
                  {lesson.students.length}/{lesson.classCapacity}
                </td>
                <td className="table-cell text-foreground/70">{formatPrice(lesson.price)}</td>
                <td className="table-cell">
                  <span className={`badge ${lesson.isActive ? "badge-success" : "badge-neutral"}`}>
                    {lesson.isActive ? "Activa" : "Dada de baja"}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex items-center justify-end gap-2">
                    {confirmingId === lesson.id ? (
                      <>
                        <button type="button" onClick={() => handleDeactivate(lesson.id)} className="btn btn-sm btn-danger-soft">
                          Sí, dar de baja
                        </button>
                        <button type="button" onClick={() => setConfirmingId(null)} className="btn btn-sm btn-outline">
                          Volver
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`Ver los turnos de la clase de ${lesson.teacherName}`}
                          title="Ver los turnos"
                          onClick={() => setDialog({ classesOf: lesson })}
                          className="icon-btn"
                        >
                          <CalendarDays className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Alumnos de la clase de ${lesson.teacherName}`}
                          title="Alumnos"
                          onClick={() => setDialog({ studentsOf: lesson.id })}
                          className="icon-btn"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        {lesson.isActive ? (
                          <button
                            type="button"
                            aria-label={`Dar de baja la clase de ${lesson.teacherName}`}
                            title="Dar de baja"
                            onClick={() => setConfirmingId(lesson.id)}
                            className="icon-btn hover:border-danger/40 hover:text-danger"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog === "create" ? (
        <CreateLessonDialog
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await reload();
          }}
        />
      ) : null}
      {studentsOf ? <StudentsDialog lesson={studentsOf} onClose={() => setDialog(null)} onChanged={reload} /> : null}
      {dialog !== null && typeof dialog === "object" && "classesOf" in dialog ? (
        <LessonClassesDialog lesson={dialog.classesOf} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function DialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 m-0 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 touch-target hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Jugadores registrados del panel, para elegir al profesor o inscribir alumnos. */
function usePlayers() {
  const [players, setPlayers] = useState<PlayerAdminItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getPlayersAdmin().then((result) => {
      if (result.success) setPlayers(result.data);
      else setError(result.error);
    });
  }, []);
  return { players, error };
}

/** Jugadores que coinciden con lo buscado (nombre, apellido o email), recién cuando se escribe algo. */
function matchingPlayers(players: PlayerAdminItem[] | null, search: string, excludedIds: number[]) {
  const term = search.trim().toLowerCase();
  if (!term) return [];
  return (players ?? []).filter(
    (player) =>
      !excludedIds.includes(player.id) && `${fullName(player)} ${player.email}`.toLowerCase().includes(term),
  );
}

type ScheduleDraft = { courtId: string; dayOfWeek: DayOfWeek; startTime: string; endTime: string };

const EMPTY_SCHEDULE: ScheduleDraft = { courtId: "", dayOfWeek: DayOfWeek.MONDAY, startTime: "", endTime: "" };

function CreateLessonDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const { players } = usePlayers();
  const [courts, setCourts] = useState<{ id: number; number: number }[]>([]);
  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState<PlayerAdminItem | null>(null);
  const [classCapacity, setClassCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([EMPTY_SCHEDULE]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getCourts().then((result) => {
      // Las canchas dadas de baja no reciben clases nuevas.
      if (result.success) setCourts(result.data.filter((court) => court.state !== CourtState.CLOSED_DOWN));
    });
  }, []);

  function updateSchedule(index: number, change: Partial<ScheduleDraft>) {
    setSchedules((current) => current.map((schedule, i) => (i === index ? { ...schedule, ...change } : schedule)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const result = await createLesson({
      teacherId: teacher?.id ?? 0,
      classCapacity: Number(classCapacity),
      price: Number(price),
      fromDate,
      toDate,
      schedules: schedules.map((schedule) => ({
        courtId: Number(schedule.courtId),
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })),
    });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await onSaved();
  }

  const candidates = matchingPlayers(players, search, []);

  return (
    <DialogFrame title="Nueva clase" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {teacher ? (
            <p className="text-sm font-semibold text-foreground">Profesor: {fullName(teacher)}</p>
          ) : null}
          {players ? (
            <div>
              <label htmlFor="lesson-teacher-search" className={LABEL_CLASS}>
                Buscar profesor
              </label>
              <input
                id="lesson-teacher-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, apellido o email de un jugador"
                className={INPUT_CLASS}
              />
            </div>
          ) : (
            <p className="text-sm text-foreground/60">Cargando jugadores...</p>
          )}
          {candidates.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {candidates.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{fullName(player)}</p>
                    <p className="text-xs text-foreground/60">{player.email}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Elegir a ${fullName(player)}`}
                    onClick={() => {
                      setTeacher(player);
                      setSearch("");
                    }}
                    className="btn btn-sm btn-outline"
                  >
                    Elegir
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lesson-capacity" className={LABEL_CLASS}>
              Cupo de alumnos
            </label>
            <input
              id="lesson-capacity"
              type="number"
              min={1}
              max={8}
              value={classCapacity}
              onChange={(event) => setClassCapacity(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="lesson-price" className={LABEL_CLASS}>
              Precio
            </label>
            <input
              id="lesson-price"
              type="number"
              min={0}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="lesson-from" className={LABEL_CLASS}>
              Desde
            </label>
            <input
              id="lesson-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="lesson-to" className={LABEL_CLASS}>
              Hasta
            </label>
            <input
              id="lesson-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className={LABEL_CLASS}>Horarios semanales</legend>
          {schedules.map((schedule, index) => {
            const n = index + 1;
            return (
              <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3">
                <select
                  aria-label={`Cancha del horario ${n}`}
                  value={schedule.courtId}
                  onChange={(event) => updateSchedule(index, { courtId: event.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="">Cancha</option>
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>
                      Cancha {court.number}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Día del horario ${n}`}
                  value={schedule.dayOfWeek}
                  onChange={(event) => updateSchedule(index, { dayOfWeek: event.target.value as DayOfWeek })}
                  className={INPUT_CLASS}
                >
                  {Object.values(DayOfWeek).map((day) => (
                    <option key={day} value={day}>
                      {DAY_LABELS[day]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Inicio del horario ${n}`}
                  type="time"
                  value={schedule.startTime}
                  onChange={(event) => updateSchedule(index, { startTime: event.target.value })}
                  className={INPUT_CLASS}
                />
                <div className="flex items-center gap-2">
                  <input
                    aria-label={`Fin del horario ${n}`}
                    type="time"
                    value={schedule.endTime}
                    onChange={(event) => updateSchedule(index, { endTime: event.target.value })}
                    className={INPUT_CLASS}
                  />
                  {schedules.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Quitar el horario ${n}`}
                      title="Quitar el horario"
                      onClick={() => setSchedules((current) => current.filter((_, i) => i !== index))}
                      className="icon-btn hover:border-danger/40 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setSchedules((current) => [...current, EMPTY_SCHEDULE])}
            className="btn btn-sm btn-outline"
          >
            <Plus className="h-4 w-4" />
            Agregar horario
          </button>
        </fieldset>

        {error ? <div className="alert-error">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={isSaving} className="btn btn-primary">
            Crear clase
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function StudentsDialog({
  lesson,
  onClose,
  onChanged,
}: {
  lesson: LessonItem;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { players } = usePlayers();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? null);
      return;
    }
    setSearch("");
    await onChanged();
  }

  const candidates = matchingPlayers(players, search, [
    lesson.teacherId,
    ...lesson.students.map((student) => student.id),
  ]);

  return (
    <DialogFrame title={`Alumnos de la clase de ${lesson.teacherName}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-foreground/60">
          {lesson.students.length}/{lesson.classCapacity} alumnos
        </p>
        {lesson.students.length > 0 ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {lesson.students.map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fullName(student)}</p>
                  <p className="text-xs text-foreground/60">{student.email}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Dar de baja a ${fullName(student)}`}
                  title="Dar de baja"
                  onClick={() => run(() => removeLessonStudentAdmin(lesson.id, student.id))}
                  className="icon-btn hover:border-danger/40 hover:text-danger"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/60">Todavía no hay alumnos inscriptos.</p>
        )}

        {players ? (
          <div>
            <label htmlFor="lesson-student-search" className={LABEL_CLASS}>
              Buscar alumno
            </label>
            <input
              id="lesson-student-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, apellido o email de un jugador"
              className={INPUT_CLASS}
            />
          </div>
        ) : (
          <p className="text-sm text-foreground/60">Cargando jugadores...</p>
        )}
        {candidates.length > 0 ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {candidates.map((player) => (
              <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fullName(player)}</p>
                  <p className="text-xs text-foreground/60">{player.email}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Inscribir a ${fullName(player)}`}
                  onClick={() => run(() => addLessonStudentAdmin(lesson.id, player.id))}
                  className="btn btn-sm btn-primary"
                >
                  <UserPlus className="h-4 w-4" />
                  Inscribir
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <div className="alert-error">{error}</div> : null}
      </div>
    </DialogFrame>
  );
}

/** Turnos de una clase (próximos y de los últimos días), para supervisar el uso de las canchas (HU-48). */
function LessonClassesDialog({ lesson, onClose }: { lesson: LessonItem; onClose: () => void }) {
  const [classes, setClasses] = useState<TeacherClassItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLessonClassesAdmin(lesson.id).then((result) => {
      if (result.success) setClasses(result.data);
      else setError(result.error);
    });
  }, [lesson.id]);

  return (
    <DialogFrame title={`Turnos de la clase de ${lesson.teacherName}`} onClose={onClose}>
      {error ? <div className="alert-error">{error}</div> : null}
      {classes === null && !error ? <p className="text-sm text-foreground/60">Cargando turnos...</p> : null}
      {classes?.length === 0 ? (
        <p className="text-sm text-foreground/60">No tiene turnos próximos ni de los últimos 7 días.</p>
      ) : null}
      <ul className="space-y-3">
        {classes?.map((session) => {
          const start = new Date(session.fromDateTime);
          const end = new Date(start.getTime() + session.durationMinutes * 60_000);
          return (
            <li key={session.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  Cancha {session.courtNumber} · {formatLongDate(start)} · {dateToTimeLabel(start)} – {dateToTimeLabel(end)}
                </p>
                <span className="badge badge-neutral">
                  {session.isFinished ? "Finalizado" : `${session.students.length}/${session.classCapacity} alumnos`}
                </span>
              </div>
              {session.students.length > 0 ? (
                <p className="mt-2 text-sm text-foreground/70">{session.students.map(fullName).join(", ")}</p>
              ) : (
                <p className="mt-2 text-sm text-foreground/50">Sin alumnos inscriptos.</p>
              )}
            </li>
          );
        })}
      </ul>
    </DialogFrame>
  );
}
