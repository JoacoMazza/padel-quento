import { CalendarDays, Clock } from "lucide-react";
import type { TeacherClassItem } from "@/src/actions/teacherClass";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { formatLongDate } from "@/app/bookings/slot-utils";
import { occupancyLabel } from "@/app/components/lesson-labels";

/**
 * Agenda del profesor (HU-46): los próximos turnos de sus clases con los
 * alumnos inscriptos. Debajo, los que terminaron hace poco, como "Finalizado".
 * Los alumnos se manejan desde cada clase, no desde un turno.
 */
export function TeacherClassesBoard({ classes }: { classes: TeacherClassItem[] }) {
  if (classes.length === 0) {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-10 text-center">
        <CalendarDays className="h-8 w-8 text-foreground/40" aria-hidden="true" />
        <p className="text-sm text-foreground/60">
          Todavía no tenés turnos de clase. El club te asigna las clases desde el panel.
        </p>
      </div>
    );
  }

  const upcoming = classes.filter((session) => !session.isFinished);
  // Los finalizados, del más reciente al más viejo.
  const finished = classes.filter((session) => session.isFinished).reverse();

  return (
    <div className="mt-10 space-y-10">
      <section aria-labelledby="upcoming-classes" className="space-y-4">
        <h2 id="upcoming-classes" className="label-caps">
          Próximas clases
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-8 text-center text-sm text-foreground/60">No tenés próximos turnos de clase.</div>
        ) : (
          upcoming.map((session) => <ClassCard key={session.id} session={session} />)
        )}
      </section>
      {finished.length > 0 ? (
        <section aria-labelledby="finished-classes" className="space-y-4">
          <h2 id="finished-classes" className="label-caps">
            Finalizadas
          </h2>
          {finished.map((session) => (
            <ClassCard key={session.id} session={session} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ClassCard({ session }: { session: TeacherClassItem }) {
  const start = new Date(session.fromDateTime);
  const end = new Date(start.getTime() + session.durationMinutes * 60_000);
  const isFull = session.students.length >= session.classCapacity;
  const titleId = `class-${session.id}-title`;

  return (
    <article aria-labelledby={titleId} className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-bold text-foreground">
            Cancha {session.courtNumber}
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
        {session.isFinished ? (
          <span className="badge badge-neutral">Finalizado</span>
        ) : (
          <span className={`badge ${isFull ? "badge-neutral" : "badge-success"}`}>
            {occupancyLabel(session.students.length, session.classCapacity)}
          </span>
        )}
      </div>

      {session.students.length > 0 ? (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {session.students.map((student) => (
            <li key={student.id} className="px-4 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                {student.names} {student.lastnames}
              </p>
              <p className="text-xs text-foreground/60">{student.email}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/60">Sin alumnos inscriptos.</p>
      )}
    </article>
  );
}
