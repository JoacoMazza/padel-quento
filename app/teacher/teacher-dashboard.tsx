"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import {
  addLessonStudent,
  getTeacherClasses,
  getTeacherLessons,
  getTeacherStudents,
  type LessonItem,
  type TeacherClassItem,
  type TeacherStudentItem,
} from "@/src/actions/teacherClass";
import { scheduleLabel } from "@/app/components/lesson-labels";
import { TeacherClassesBoard } from "@/app/teacher/teacher-classes-board";
import { TeacherLessonsBoard } from "@/app/teacher/teacher-lessons-board";

type Tab = "agenda" | "lessons" | "students";

const TABS: { id: Tab; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "lessons", label: "Clases" },
  { id: "students", label: "Alumnos" },
];

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Mis clases del profesor, en tres pestañas: la agenda de los turnos de sus
 * clases (HU-46), sus clases con los alumnos inscriptos (HU-44) y el listado
 * de sus alumnos (HU-45), desde donde inscribe rápido a un alumno en una
 * clase. Un cambio en una actualiza las otras.
 */
export function TeacherDashboard({
  classes: initialClasses,
  lessons: initialLessons,
  students: initialStudents,
}: {
  classes: TeacherClassItem[];
  lessons: LessonItem[];
  students: TeacherStudentItem[];
}) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [classes, setClasses] = useState(initialClasses);
  const [lessons, setLessons] = useState(initialLessons);
  const [students, setStudents] = useState(initialStudents);
  // Las clases manejan su propio estado: se vuelven a montar con los datos nuevos tras un cambio desde el listado.
  const [lessonsVersion, setLessonsVersion] = useState(0);

  async function reloadAgendaAndStudents() {
    const [classesResult, studentsResult] = await Promise.all([getTeacherClasses(), getTeacherStudents()]);
    if (classesResult.success) setClasses(classesResult.data);
    if (studentsResult.success) setStudents(studentsResult.data);
  }

  async function reloadAll() {
    const [lessonsResult] = await Promise.all([getTeacherLessons(), reloadAgendaAndStudents()]);
    if (lessonsResult.success) {
      setLessons(lessonsResult.data);
      setLessonsVersion((version) => version + 1);
    }
  }

  return (
    <div className="mt-10">
      <div role="tablist" aria-label="Mis clases" className="flex gap-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`teacher-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`teacher-panel-${id}`}
            onClick={() => setTab(id)}
            className={`chip ${tab === id ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="teacher-panel-agenda" aria-labelledby="teacher-tab-agenda" hidden={tab !== "agenda"}>
        <TeacherClassesBoard classes={classes} />
      </div>
      <div role="tabpanel" id="teacher-panel-lessons" aria-labelledby="teacher-tab-lessons" hidden={tab !== "lessons"}>
        <TeacherLessonsBoard
          key={lessonsVersion}
          lessons={lessons}
          onChanged={(updated) => {
            setLessons(updated);
            reloadAgendaAndStudents();
          }}
        />
      </div>
      <div
        role="tabpanel"
        id="teacher-panel-students"
        aria-labelledby="teacher-tab-students"
        hidden={tab !== "students"}
      >
        {tab === "students" ? <StudentsList students={students} lessons={lessons} onChanged={reloadAll} /> : null}
      </div>
    </div>
  );
}

function StudentsList({
  students,
  lessons,
  onChanged,
}: {
  students: TeacherStudentItem[];
  lessons: LessonItem[];
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);

  if (students.length === 0) {
    return (
      <div className="card mt-6 p-8 text-center text-sm text-foreground/60">
        Todavía no registraste alumnos en tus clases.
      </div>
    );
  }

  // Clases con lugar, para inscribir rápido a un alumno que todavía no está en ellas.
  const openLessons = lessons.filter((lesson) => lesson.students.length < lesson.classCapacity);

  async function add(lessonId: number, studentId: number) {
    setError(null);
    const result = await addLessonStudent(lessonId, studentId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await onChanged();
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <div className="alert-error">{error}</div> : null}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="table-head">Alumno</th>
              <th className="table-head">Contacto</th>
              <th className="table-head">Clases</th>
              <th className="table-head">Última clase</th>
              <th className="table-head">Sumar a una clase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                options={openLessons.filter((lesson) => !lesson.students.some((s) => s.id === student.id))}
                onAdd={(lessonId) => add(lessonId, student.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentRow({
  student,
  options,
  onAdd,
}: {
  student: TeacherStudentItem;
  options: LessonItem[];
  onAdd: (lessonId: number) => Promise<void>;
}) {
  const [classId, setClassId] = useState("");
  const fullName = `${student.names} ${student.lastnames}`;
  const selectId = `student-${student.id}-class`;

  return (
    <tr>
      <td className="table-cell font-semibold text-foreground">{fullName}</td>
      <td className="table-cell">
        <p className="text-foreground/70">{student.email}</p>
        <p className="text-xs text-foreground/60">{student.phoneNumber}</p>
      </td>
      <td className="table-cell text-foreground/70">{student.classesCount}</td>
      <td className="table-cell text-foreground/70">
        {student.lastClassAt ? SHORT_DATE_FORMATTER.format(new Date(student.lastClassAt)) : "Sin clases todavía"}
      </td>
      <td className="table-cell">
        {options.length === 0 ? (
          <span className="text-xs text-foreground/50">Sin clases con lugar</span>
        ) : (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="sr-only">
              Clase para {fullName}
            </label>
            <select
              id={selectId}
              value={classId}
              onChange={(event) => setClassId(event.target.value)}
              className="field min-w-48"
            >
              <option value="">Elegí una clase</option>
              {options.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.schedules.map(scheduleLabel).join(" / ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Agregar a ${fullName} a la clase`}
              title="Agregar a la clase"
              disabled={!classId}
              onClick={async () => {
                await onAdd(Number(classId));
                setClassId("");
              }}
              className="icon-btn"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
