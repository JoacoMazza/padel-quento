"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Power, UserMinus, UserPlus, Users, X } from "lucide-react";
import {
  assignTeacherRole,
  createTeacher,
  getTeacherClassesAdmin,
  getTeachersAdmin,
  removeTeacherRole,
  setTeacherActive,
  type TeacherAdminItem,
} from "@/src/actions/teacher";
import { getPlayersAdmin, type PlayerAdminItem } from "@/src/actions/player";
import type { TeacherClassItem } from "@/src/actions/teacherClass";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { formatLongDate } from "@/app/bookings/slot-utils";
import { INPUT_CLASS, LABEL_CLASS } from "@/app/admin/holder-fields";

type Dialog = "create" | "assign" | { classesOf: TeacherAdminItem };

/**
 * Sección Profesores del panel (HU-42), para cualquier administrador: alta de
 * un profesor nuevo o el rol de profesor para un jugador que ya existe, y
 * desactivar, reactivar o quitarle el rol (sigue siendo jugador). También se
 * consultan las clases de cada profesor (HU-48).
 */
export function TeachersPanel({ teachers: initialTeachers }: { teachers: TeacherAdminItem[] }) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const result = await getTeachersAdmin();
    if (result.success) setTeachers(result.data);
  }

  async function handleSaved() {
    setDialog(null);
    await reload();
  }

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    setConfirmingRemoveId(null);
    const result = await action();
    if (!result.success) {
      setError(result.error ?? null);
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">
          Los profesores reservan sus turnos de clase y registran a sus alumnos. Siguen siendo jugadores.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDialog("assign")} className="btn btn-sm btn-outline">
            <Users className="h-4 w-4" />
            Asignar a un jugador
          </button>
          <button type="button" onClick={() => setDialog("create")} className="btn btn-sm btn-primary">
            <UserPlus className="h-4 w-4" />
            Nuevo profesor
          </button>
        </div>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="table-head">Nombre</th>
              <th className="table-head">Email</th>
              <th className="table-head">Teléfono</th>
              <th className="table-head">Estado</th>
              <th className="table-head text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-cell text-center text-foreground/60">
                  Todavía no hay profesores.
                </td>
              </tr>
            ) : null}
            {teachers.map((teacher) => {
              const fullName = `${teacher.names} ${teacher.lastnames}`;
              return (
                <tr key={teacher.id}>
                  <td className="table-cell font-semibold text-foreground">{fullName}</td>
                  <td className="table-cell text-foreground/70">{teacher.email}</td>
                  <td className="table-cell text-foreground/70">{teacher.phoneNumber}</td>
                  <td className="table-cell">
                    <span className={`badge ${teacher.isActive ? "badge-success" : "badge-neutral"}`}>
                      {teacher.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      {confirmingRemoveId === teacher.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => run(() => removeTeacherRole(teacher.id))}
                            className="btn btn-sm btn-danger-soft"
                          >
                            Sí, quitar el rol
                          </button>
                          <button type="button" onClick={() => setConfirmingRemoveId(null)} className="btn btn-sm btn-outline">
                            Volver
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Ver las clases de ${fullName}`}
                            title="Ver las clases"
                            onClick={() => setDialog({ classesOf: teacher })}
                            className="icon-btn"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`${teacher.isActive ? "Desactivar" : "Reactivar"} a ${fullName}`}
                            title={teacher.isActive ? "Desactivar" : "Reactivar"}
                            onClick={() => run(() => setTeacherActive(teacher.id, !teacher.isActive))}
                            className="icon-btn"
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Quitar el rol de profesor a ${fullName}`}
                            title="Quitar el rol de profesor"
                            onClick={() => setConfirmingRemoveId(teacher.id)}
                            className="icon-btn hover:border-danger/40 hover:text-danger"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog === "create" ? <CreateTeacherDialog onClose={() => setDialog(null)} onSaved={handleSaved} /> : null}
      {dialog === "assign" ? (
        <AssignTeacherDialog
          teacherPlayerIds={teachers.map((teacher) => teacher.playerId)}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      ) : null}
      {dialog !== null && typeof dialog === "object" ? (
        <TeacherClassesDialog teacher={dialog.classesOf} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

/** Clases de un profesor (próximas y de los últimos días), para supervisar el uso de las canchas (HU-48). */
function TeacherClassesDialog({ teacher, onClose }: { teacher: TeacherAdminItem; onClose: () => void }) {
  const [classes, setClasses] = useState<TeacherClassItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fullName = `${teacher.names} ${teacher.lastnames}`;

  useEffect(() => {
    getTeacherClassesAdmin(teacher.id).then((result) => {
      if (result.success) setClasses(result.data);
      else setError(result.error);
    });
  }, [teacher.id]);

  return (
    <DialogFrame title={`Clases de ${fullName}`} onClose={onClose}>
      {error ? <div className="alert-error">{error}</div> : null}
      {classes === null && !error ? <p className="text-sm text-foreground/60">Cargando clases...</p> : null}
      {classes?.length === 0 ? (
        <p className="text-sm text-foreground/60">No tiene clases próximas ni de los últimos 7 días.</p>
      ) : null}
      <ul className="space-y-3">
        {classes?.map((lesson) => {
          const start = new Date(lesson.fromDateTime);
          const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
          const titleId = `admin-class-${lesson.id}`;
          return (
            <li key={lesson.id} aria-labelledby={titleId} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p id={titleId} className="font-semibold text-foreground">
                  Cancha {lesson.courtNumber} · {formatLongDate(start)} · {dateToTimeLabel(start)} – {dateToTimeLabel(end)}
                </p>
                <span className="badge badge-neutral">
                  {lesson.isFinished ? "Finalizado" : `${lesson.students.length}/${lesson.classCapacity} alumnos`}
                </span>
              </div>
              {lesson.students.length > 0 ? (
                <p className="mt-2 text-sm text-foreground/70">
                  {lesson.students.map((student) => `${student.names} ${student.lastnames}`).join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-sm text-foreground/50">Sin alumnos registrados.</p>
              )}
            </li>
          );
        })}
      </ul>
    </DialogFrame>
  );
}

function DialogFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
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

const CREATE_FIELDS = [
  { name: "names", label: "Nombre", type: "text" },
  { name: "lastnames", label: "Apellido", type: "text" },
  { name: "email", label: "Email", type: "email" },
  { name: "phoneNumber", label: "Teléfono", type: "tel" },
  { name: "password", label: "Contraseña", type: "password" },
] as const;

function CreateTeacherDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    const result = await createTeacher(new FormData(event.currentTarget));
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <DialogFrame title="Nuevo profesor" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {CREATE_FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={`teacher-${field.name}`} className={LABEL_CLASS}>
              {field.label}
            </label>
            <input id={`teacher-${field.name}`} name={field.name} type={field.type} className={INPUT_CLASS} />
          </div>
        ))}
        {error ? <div className="alert-error">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={isSaving} className="btn btn-primary">
            Crear profesor
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

function AssignTeacherDialog({
  teacherPlayerIds,
  onClose,
  onSaved,
}: {
  teacherPlayerIds: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [players, setPlayers] = useState<PlayerAdminItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlayersAdmin().then((result) => {
      if (result.success) setPlayers(result.data);
      else setError(result.error);
    });
  }, []);

  const term = search.trim().toLowerCase();
  // Solo los que todavía no son profesores, y recién cuando se escribe algo para buscar.
  const matches = term
    ? (players ?? []).filter(
        (player) =>
          !teacherPlayerIds.includes(player.id) &&
          `${player.names} ${player.lastnames} ${player.email}`.toLowerCase().includes(term),
      )
    : [];

  async function assign(playerId: number) {
    setError(null);
    const result = await assignTeacherRole(playerId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <DialogFrame title="Asignar el rol de profesor" onClose={onClose}>
      <div className="space-y-4">
        {players ? (
          <div>
            <label htmlFor="teacher-player-search" className={LABEL_CLASS}>
              Buscar jugador
            </label>
            <input
              id="teacher-player-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, apellido o email"
              className={INPUT_CLASS}
            />
          </div>
        ) : (
          <p className="text-sm text-foreground/60">Cargando jugadores...</p>
        )}
        {term && matches.length === 0 ? (
          <p className="text-sm text-foreground/60">No hay jugadores que coincidan (o ya son profesores).</p>
        ) : null}
        <ul className="divide-y divide-line">
          {matches.map((player) => {
            const fullName = `${player.names} ${player.lastnames}`;
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-semibold text-foreground">{fullName}</p>
                  <p className="text-xs text-foreground/60">{player.email}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Hacer profesor a ${fullName}`}
                  onClick={() => assign(player.id)}
                  className="btn btn-sm btn-primary"
                >
                  Hacer profesor
                </button>
              </li>
            );
          })}
        </ul>
        {error ? <div className="alert-error">{error}</div> : null}
      </div>
    </DialogFrame>
  );
}
