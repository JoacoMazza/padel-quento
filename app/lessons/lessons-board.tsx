"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, GraduationCap, Users } from "lucide-react";
import { enrollInLesson, leaveLesson, type AvailableLessonItem } from "@/src/actions/lesson";
import { formatPrice } from "@/app/bookings/slot-utils";
import { lessonDatesLabel, scheduleLabel } from "@/app/components/lesson-labels";

/**
 * Clases abiertas del club: cada una con su profesor, horarios, fechas, precio
 * y lugares. El jugador se inscribe (va a todos sus turnos) o se da de baja.
 */
export function LessonsBoard({ lessons, isGuest }: { lessons: AvailableLessonItem[]; isGuest: boolean }) {
  if (lessons.length === 0) {
    return (
      <div className="card mt-10 flex flex-col items-center gap-3 p-10 text-center">
        <GraduationCap className="h-8 w-8 text-foreground/40" aria-hidden="true" />
        <p className="text-sm text-foreground/60">Por ahora no hay clases abiertas.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2">
      {lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} isGuest={isGuest} />
      ))}
    </div>
  );
}

function LessonCard({ lesson, isGuest }: { lesson: AvailableLessonItem; isGuest: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isFull = lesson.studentsCount >= lesson.classCapacity;
  const titleId = `lesson-${lesson.id}-title`;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error ?? null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <article aria-labelledby={titleId} className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-bold text-foreground">
          Clase con {lesson.teacherName}
        </h2>
        <span className="font-bold text-foreground">{formatPrice(lesson.price)}</span>
      </div>

      <div className="space-y-1 text-sm text-foreground/70">
        {lesson.schedules.map((schedule) => (
          <p key={`${schedule.dayOfWeek}-${schedule.startTime}`}>{scheduleLabel(schedule)}</p>
        ))}
        <p className="flex items-center gap-1.5 text-foreground/60">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {lessonDatesLabel(lesson.fromDate, lesson.toDate)}
        </p>
        <p className="flex items-center gap-1.5 text-foreground/60">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {lesson.studentsCount}/{lesson.classCapacity} alumnos
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {lesson.isOwn ? (
          <span className="badge badge-neutral">La das vos</span>
        ) : isGuest ? (
          <Link href={`/login?callbackUrl=${encodeURIComponent("/lessons")}`} className="btn btn-sm btn-primary">
            Iniciá sesión para inscribirte
          </Link>
        ) : lesson.isEnrolled ? (
          <>
            <span className="badge badge-success">Estás inscripto</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => leaveLesson(lesson.id))}
              className="btn btn-sm btn-outline"
            >
              Darme de baja
            </button>
          </>
        ) : isFull ? (
          <span className="badge badge-neutral">Completa</span>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => enrollInLesson(lesson.id))}
            className="btn btn-sm btn-primary"
          >
            Inscribirme
          </button>
        )}
      </div>
      {error ? <div className="alert-error">{error}</div> : null}
    </article>
  );
}
