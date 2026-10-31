"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import {
  addClassStudent,
  getTeacherClasses,
  getTeacherStudents,
  type TeacherClassItem,
  type TeacherStudentItem,
} from "@/src/actions/teacherClass";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { TeacherClassesBoard } from "@/app/teacher/teacher-classes-board";

type Tab = "agenda" | "students";

const TABS: { id: Tab; label: string }[] = [
  { id: "agenda", label: "Agenda" },
  { id: "students", label: "Alumnos" },
];

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const CLASS_OPTION_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" });

/**
 * Mis clases del profesor, en dos pestañas: la agenda de sus turnos de clase
 * (HU-46) y el listado de sus alumnos (HU-45), desde donde suma rápido a un
 * alumno a un próximo turno de clase. Un cambio en una actualiza la otra.
 */
export function TeacherDashboard({
  classes: initialClasses,
  students: initialStudents,
}: {
  classes: TeacherClassItem[];
  students: TeacherStudentItem[];
}) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [classes, setClasses] = useState(initialClasses);
  const [students, setStudents] = useState(initialStudents);
  // La agenda maneja su propio estado: se vuelve a montar con los datos nuevos tras un cambio desde el listado.
  const [agendaVersion, setAgendaVersion] = useState(0);

  async function reloadStudents() {
    const result = await getTeacherStudents();
    if (result.success) setStudents(result.data);
  }

  async function reloadAll() {
    const [classesResult] = await Promise.all([getTeacherClasses(), reloadStudents()]);
    if (classesResult.success) {
      setClasses(classesResult.data);
      setAgendaVersion((version) => version + 1);
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
        <TeacherClassesBoard
          key={agendaVersion}
          classes={classes}
          onChanged={(updated) => {
            setClasses(updated);
            reloadStudents();
          }}
        />
      </div>
      <div
        role="tabpanel"
        id="teacher-panel-students"
        aria-labelledby="teacher-tab-students"
        hidden={tab !== "students"}
      >
        {tab === "students" ? <StudentsList students={students} classes={classes} onChanged={reloadAll} /> : null}
      </div>
    </div>
  );
}

function StudentsList({
  students,
  classes,
  onChanged,
}: {
  students: TeacherStudentItem[];
  classes: TeacherClassItem[];
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

  // Próximas clases con lugar, para sumar rápido a un alumno que todavía no está en ellas.
  const openClasses = classes.filter(
    (lesson) => !lesson.isFinished && lesson.students.length < lesson.classCapacity,
  );

  async function add(classId: number, studentId: number) {
    setError(null);
    const result = await addClassStudent(classId, studentId);
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
                options={openClasses.filter((lesson) => !lesson.students.some((s) => s.id === student.id))}
                onAdd={(classId) => add(classId, student.id)}
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
  options: TeacherClassItem[];
  onAdd: (classId: number) => Promise<void>;
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
              {options.map((lesson) => {
                const start = new Date(lesson.fromDateTime);
                return (
                  <option key={lesson.id} value={lesson.id}>
                    {CLASS_OPTION_FORMATTER.format(start)} · {dateToTimeLabel(start)} · Cancha {lesson.courtNumber}
                  </option>
                );
              })}
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
