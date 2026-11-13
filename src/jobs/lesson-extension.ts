import { extendLessons } from "@/src/actions/lesson";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const globalForJob = globalThis as unknown as {
  lessonExtensionInterval?: NodeJS.Timeout;
};

/**
 * Arranca el chequeo periódico que reserva los turnos nuevos de las clases sin fecha de fin
 * a medida que entran en el horizonte de 6 meses (ver extendLessons).
 * Mismo patrón que src/jobs/attendance-points.ts: el interval se guarda en
 * globalThis para que el hot-reload de Next en desarrollo no lo duplique.
 */
export function startLessonExtensionJob() {
  if (globalForJob.lessonExtensionInterval) {
    return;
  }

  const runCheck = () => {
    extendLessons().catch((error) => {
      console.error("lessonExtensionJob", error);
    });
  };

  // Corre una vez al arrancar: si el server estuvo apagado, se ponen al día las fechas.
  runCheck();

  globalForJob.lessonExtensionInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  globalForJob.lessonExtensionInterval.unref?.();
}
