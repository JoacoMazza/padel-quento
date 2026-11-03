"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, UserMinus, UserPlus } from "lucide-react";
import {
  addClassStudent,
  getTeacherClasses,
  removeClassStudent,
  searchStudents,
  type StudentItem,
  type TeacherClassItem,
} from "@/src/actions/teacherClass";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { formatLongDate } from "@/app/bookings/slot-utils";

const MIN_SEARCH_LENGTH = 2;

/** "1/2 alumnos · 1 lugar libre", o "· completa" si no quedan lugares. */
function occupancyLabel(lesson: TeacherClassItem): string {
  const free = lesson.classCapacity - lesson.students.length;
  const freeLabel = free <= 0 ? "completa" : `${free} ${free === 1 ? "lugar libre" : "lugares libres"}`;
  return `${lesson.students.length}/${lesson.classCapacity} alumnos · ${freeLabel}`;
}

/**
 * Agenda del profesor (HU-46): sus próximos turnos de clase con los alumnos,
 * donde busca jugadores registrados y los suma hasta el cupo o los quita
 * mientras la clase no empezó (HU-44, el servidor lo verifica). Debajo, las
 * clases que terminaron hace poco, como "Finalizado" y sin cambios.
 */
export function TeacherClassesBoard({
  classes: initialClasses,
  onChanged,
}: {
  classes: TeacherClassItem[];
  /** Avisa que cambiaron los alumnos de una clase, con la agenda actualizada (por ejemplo, para el listado de alumnos). */
  onChanged?: (classes: TeacherClassItem[]) => void;
}) {
  const [classes, setClasses] = useState(initialClasses);

  async function reload() {
    const result = await getTeacherClasses();
    if (!result.success) return;
    setClasses(result.data);
    onChanged?.(result.data);
  }

  if (classes.length === 0) {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-10 text-center">
        <CalendarDays className="h-8 w-8 text-foreground/40" aria-hidden="true" />
        <p className="text-sm text-foreground/60">Todavía no tenés turnos de clase.</p>
        <Link href="/teacher/book" className="btn btn-primary btn-sm">
          Reservar clase
        </Link>
      </div>
    );
  }

  const upcoming = classes.filter((lesson) => !lesson.isFinished);
  // Las finalizadas, de la más reciente a la más vieja.
  const finished = classes.filter((lesson) => lesson.isFinished).reverse();

  return (
    <div className="mt-10 space-y-10">
      <section aria-labelledby="upcoming-classes" className="space-y-4">
        <h2 id="upcoming-classes" className="label-caps">
          Próximas clases
        </h2>
        {upcoming.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-foreground/60">No tenés próximos turnos de clase.</p>
            <Link href="/teacher/book" className="btn btn-primary btn-sm">
              Reservar clase
            </Link>
          </div>
        ) : (
          upcoming.map((lesson) => <ClassCard key={lesson.id} lesson={lesson} onChanged={reload} />)
        )}
      </section>
      {finished.length > 0 ? (
        <section aria-labelledby="finished-classes" className="space-y-4">
          <h2 id="finished-classes" className="label-caps">
            Finalizadas
          </h2>
          {finished.map((lesson) => (
            <ClassCard key={lesson.id} lesson={lesson} onChanged={reload} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ClassCard({ lesson, onChanged }: { lesson: TeacherClassItem; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Lo último que se escribió: una respuesta de otra búsqueda que llega tarde se descarta.
  const latestSearchRef = useRef("");
  const start = new Date(lesson.fromDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  const isFull = lesson.students.length >= lesson.classCapacity;
  const canEdit = !lesson.isFinished;
  const titleId = `class-${lesson.id}-title`;
  const searchId = `class-${lesson.id}-search`;

  async function handleSearch(value: string) {
    setSearch(value);
    latestSearchRef.current = value;
    if (value.trim().length < MIN_SEARCH_LENGTH) {
      setResults([]);
      return;
    }
    const result = await searchStudents(value);
    if (latestSearchRef.current !== value) return;
    if (result.success) setResults(result.data);
    else setError(result.error);
  }

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? null);
      return;
    }
    setSearch("");
    latestSearchRef.current = "";
    setResults([]);
    await onChanged();
  }

  const enrolledIds = new Set(lesson.students.map((student) => student.id));
  const candidates = results.filter((student) => !enrolledIds.has(student.id));

  return (
    <article aria-labelledby={titleId} className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            Cancha {lesson.courtNumber}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatLongDate(start)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {dateToTimeLabel(start)} – {dateToTimeLabel(end)}
            </span>
          </p>
        </div>
        {lesson.isFinished ? (
          <span className="badge badge-neutral">Finalizado</span>
        ) : (
          <span className={`badge ${isFull ? "badge-neutral" : "badge-success"}`}>{occupancyLabel(lesson)}</span>
        )}
      </div>

      {lesson.students.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {lesson.students.map((student) => {
            const fullName = `${student.names} ${student.lastnames}`;
            return (
              <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fullName}</p>
                  <p className="text-xs text-foreground/60">{student.email}</p>
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Quitar a ${fullName} de la clase`}
                    title="Quitar de la clase"
                    onClick={() => run(() => removeClassStudent(lesson.id, student.id))}
                    className="icon-btn hover:border-danger/40 hover:text-danger"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-foreground/60">
          {lesson.isFinished ? "No tuvo alumnos registrados." : "Todavía no registraste alumnos."}
        </p>
      )}

      {!canEdit || isFull ? null : (
        <div className="space-y-2">
          <label htmlFor={searchId} className="field-label">
            Buscar alumno
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Nombre, apellido o email de un jugador registrado"
            className="field"
          />
          {candidates.length > 0 ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {candidates.map((student) => {
                const fullName = `${student.names} ${student.lastnames}`;
                return (
                  <li key={student.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{fullName}</p>
                      <p className="text-xs text-foreground/60">{student.email}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Agregar a ${fullName}`}
                      onClick={() => run(() => addClassStudent(lesson.id, student.id))}
                      className="btn btn-sm btn-primary"
                    >
                      <UserPlus className="h-4 w-4" />
                      Agregar
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}

      {error ? <div className="alert-error">{error}</div> : null}
    </article>
  );
}
