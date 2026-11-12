"use client";

import { useRef, useState } from "react";
import { CalendarDays, GraduationCap, UserMinus, UserPlus } from "lucide-react";
import {
  addLessonStudent,
  getTeacherLessons,
  removeLessonStudent,
  searchStudents,
  type LessonItem,
  type StudentItem,
} from "@/src/actions/teacherClass";
import { formatDate, occupancyLabel, scheduleLabel } from "@/app/components/lesson-labels";

const MIN_SEARCH_LENGTH = 2;

/**
 * Clases activas del profesor (HU-44): en cada una busca jugadores registrados
 * y los inscribe hasta el cupo (van a todos sus turnos), o los da de baja.
 */
export function TeacherLessonsBoard({
  lessons: initialLessons,
  onChanged,
}: {
  lessons: LessonItem[];
  /** Avisa que cambiaron los alumnos de una clase, con las clases actualizadas. */
  onChanged?: (lessons: LessonItem[]) => void;
}) {
  const [lessons, setLessons] = useState(initialLessons);

  async function reload() {
    const result = await getTeacherLessons();
    if (!result.success) return;
    setLessons(result.data);
    onChanged?.(result.data);
  }

  if (lessons.length === 0) {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-10 text-center">
        <GraduationCap className="h-8 w-8 text-foreground/40" aria-hidden="true" />
        <p className="text-sm text-foreground/60">No tenés clases activas.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-4">
      {lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} onChanged={reload} />
      ))}
    </div>
  );
}

function LessonCard({ lesson, onChanged }: { lesson: LessonItem; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Lo último que se escribió: una respuesta de otra búsqueda que llega tarde se descarta.
  const latestSearchRef = useRef("");
  const isFull = lesson.students.length >= lesson.classCapacity;
  const titleId = `lesson-${lesson.id}-title`;
  const searchId = `lesson-${lesson.id}-search`;

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
            {lesson.schedules.map(scheduleLabel).join(" / ")}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-foreground/60">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Del {formatDate(lesson.fromDate)} al {formatDate(lesson.toDate)}
          </p>
        </div>
        <span className={`badge ${isFull ? "badge-neutral" : "badge-success"}`}>
          {occupancyLabel(lesson.students.length, lesson.classCapacity)}
        </span>
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
                <button
                  type="button"
                  aria-label={`Quitar a ${fullName} de la clase`}
                  title="Quitar de la clase"
                  onClick={() => run(() => removeLessonStudent(lesson.id, student.id))}
                  className="icon-btn hover:border-danger/40 hover:text-danger"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-foreground/60">Todavía no hay alumnos inscriptos.</p>
      )}

      {isFull ? null : (
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
                      onClick={() => run(() => addLessonStudent(lesson.id, student.id))}
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
